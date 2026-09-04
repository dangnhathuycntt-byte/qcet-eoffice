"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signDocumentSchema = exports.signatureRouter = void 0;
exports.calculateDocumentCanonicalHash = calculateDocumentCanonicalHash;
exports.signDocumentHandler = signDocumentHandler;
exports.getDocumentSignaturesHandler = getDocumentSignaturesHandler;
exports.verifyDocumentSignatureHandler = verifyDocumentSignatureHandler;
exports.getSignatureByIdHandler = getSignatureByIdHandler;
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = __importDefault(require("../lib/prisma"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const security_middleware_1 = require("../middleware/security.middleware");
const pdf_signature_service_1 = require("../services/pdf-signature.service");
exports.signatureRouter = (0, express_1.Router)({ mergeParams: true });
exports.signDocumentSchema = zod_1.z.object({
    signatureType: zod_1.z
        .enum(["INITIAL", "OFFICIAL", "STAMP"])
        .optional()
        .default("OFFICIAL"),
    pageNumber: zod_1.z
        .number()
        .int()
        .positive("pageNumber must be at least 1")
        .optional()
        .default(1),
    coordX: zod_1.z.number().optional().default(0),
    coordY: zod_1.z.number().optional().default(0),
    width: zod_1.z.number().positive("width must be positive").optional().default(150),
    height: zod_1.z.number().positive("height must be positive").optional().default(60),
    signatureImage: zod_1.z.string().nullable().optional(),
    documentHash: zod_1.z.string().optional(),
});
/**
 * Calculates a canonical hash for a document and its latest file version
 */
function calculateDocumentCanonicalHash(document) {
    const latestVersion = document.versions?.[0] || null;
    const canonicalData = [
        document.id,
        document.documentNumber,
        document.title,
        latestVersion?.fileUrl || "",
        latestVersion?.fileName || "",
        latestVersion?.fileSize || 0,
    ].join(":");
    return (0, pdf_signature_service_1.computeDocumentHash)(canonicalData);
}
/**
 * Handler for signing a document
 */
async function signDocumentHandler(req, res) {
    const { id } = req.params;
    const parsed = exports.signDocumentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            error: "Validation error",
            details: parsed.error.issues,
        });
        return;
    }
    const { signatureType, pageNumber, coordX, coordY, width, height, signatureImage, } = parsed.data;
    try {
        const document = await prisma_1.default.document.findUnique({
            where: { id },
            include: {
                versions: {
                    orderBy: { versionNumber: "desc" },
                },
            },
        });
        if (!document) {
            res.status(404).json({ error: "Document not found" });
            return;
        }
        if (document.status === "REJECTED") {
            res.status(400).json({
                error: "Cannot sign a rejected document",
                documentStatus: document.status,
            });
            return;
        }
        const user = req.user;
        if (!user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        const { certificateSerial, certificateOwner } = (0, pdf_signature_service_1.generateCertificateInfo)(user);
        const documentHash = parsed.data.documentHash || calculateDocumentCanonicalHash(document);
        const signedAt = new Date();
        const signatureHash = (0, pdf_signature_service_1.computeSignatureHash)({
            documentHash,
            signerId: user.id,
            certificateSerial,
            signedAt,
            signatureType,
        });
        const signerName = user.fullName || user.username || "User";
        // Generate visual signature buffer via pdf-lib
        await pdf_signature_service_1.pdfSignatureService.createVisualSignature({
            signatureType: signatureType,
            signerName,
            signerRole: user.role,
            certificateSerial,
            signedAt,
            pageNumber,
            coordX,
            coordY,
            width,
            height,
            signatureImage: signatureImage ?? null,
        });
        // Execute atomic transaction for DigitalSignature and DocumentAuditLog
        const [signature] = await prisma_1.default.$transaction(async (tx) => {
            const createdSig = await tx.digitalSignature.create({
                data: {
                    documentId: document.id,
                    signerId: user.id,
                    signatureType: signatureType,
                    certificateSerial,
                    certificateOwner,
                    signatureHash,
                    documentHash,
                    pageNumber,
                    coordX,
                    coordY,
                    width,
                    height,
                    signatureImage: signatureImage ?? null,
                    signedAt,
                },
                include: {
                    signer: {
                        select: {
                            id: true,
                            fullName: true,
                            username: true,
                            email: true,
                            role: true,
                        },
                    },
                },
            });
            await tx.documentAuditLog.create({
                data: {
                    documentId: document.id,
                    userId: user.id,
                    action: "DOCUMENT_SIGNED",
                    details: JSON.stringify({
                        signatureId: createdSig.id,
                        signatureType,
                        certificateSerial,
                        documentHash,
                        signedAt: signedAt.toISOString(),
                    }),
                    ipAddress: req.ip || req.socket.remoteAddress || null,
                },
            });
            return [createdSig];
        });
        res.status(201).json({
            success: true,
            message: "Document signed successfully",
            ...signature,
            signature,
        });
    }
    catch (error) {
        console.error("Sign document error:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error?.message || "Failed to sign document",
        });
    }
}
/**
 * Handler for fetching all signatures on a document
 */
async function getDocumentSignaturesHandler(req, res) {
    const { id } = req.params;
    try {
        const document = await prisma_1.default.document.findUnique({
            where: { id },
        });
        if (!document) {
            res.status(404).json({ error: "Document not found" });
            return;
        }
        const signatures = await prisma_1.default.digitalSignature.findMany({
            where: { documentId: id },
            include: {
                signer: {
                    select: {
                        id: true,
                        fullName: true,
                        username: true,
                        email: true,
                        role: true,
                    },
                },
            },
            orderBy: { signedAt: "asc" },
        });
        res.json(signatures);
    }
    catch (error) {
        console.error("Get document signatures error:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error?.message || "Failed to fetch signatures",
        });
    }
}
/**
 * Handler for verifying document cryptographic integrity against signatures
 */
async function verifyDocumentSignatureHandler(req, res) {
    const { id } = req.params;
    try {
        const document = await prisma_1.default.document.findUnique({
            where: { id },
            include: {
                versions: {
                    orderBy: { versionNumber: "desc" },
                },
                signatures: {
                    include: {
                        signer: {
                            select: {
                                id: true,
                                fullName: true,
                                username: true,
                                email: true,
                                role: true,
                            },
                        },
                    },
                    orderBy: { signedAt: "asc" },
                },
            },
        });
        if (!document) {
            res.status(404).json({ error: "Document not found" });
            return;
        }
        let signatures = document.signatures;
        if (!signatures) {
            signatures = await prisma_1.default.digitalSignature.findMany({
                where: { documentId: id },
                include: {
                    signer: {
                        select: {
                            id: true,
                            fullName: true,
                            username: true,
                            email: true,
                            role: true,
                        },
                    },
                },
                orderBy: { signedAt: "asc" },
            });
        }
        if (!signatures || signatures.length === 0) {
            res.json({
                isValid: false,
                tamperDetected: false,
                documentId: document.id,
                message: "No signatures registered for this document",
                signatures: [],
            });
            return;
        }
        // Determine current document checksum
        const queryHash = (req.query.currentHash || req.query.documentHash);
        const currentHash = queryHash || calculateDocumentCanonicalHash(document);
        let tamperDetected = false;
        let allSignaturesCryptographicallyValid = true;
        const evaluatedSignatures = signatures.map((sig) => {
            // Document integrity check: signature's documentHash must match current document checksum
            const isDocumentTampered = sig.documentHash !== currentHash;
            if (isDocumentTampered) {
                tamperDetected = true;
            }
            // Cryptographic signature validity check
            const expectedSigHash = (0, pdf_signature_service_1.computeSignatureHash)({
                documentHash: sig.documentHash,
                signerId: sig.signerId,
                certificateSerial: sig.certificateSerial,
                signedAt: sig.signedAt,
                signatureType: sig.signatureType,
            });
            const isSignatureValid = sig.signatureHash === expectedSigHash;
            if (!isSignatureValid) {
                allSignaturesCryptographicallyValid = false;
            }
            return {
                id: sig.id,
                signatureType: sig.signatureType,
                signerId: sig.signerId,
                signer: sig.signer,
                certificateSerial: sig.certificateSerial,
                certificateOwner: sig.certificateOwner,
                signedAt: sig.signedAt,
                pageNumber: sig.pageNumber,
                coordX: sig.coordX,
                coordY: sig.coordY,
                width: sig.width,
                height: sig.height,
                documentHash: sig.documentHash,
                signatureHash: sig.signatureHash,
                isSignatureValid,
                isDocumentTampered,
            };
        });
        const isValid = !tamperDetected &&
            allSignaturesCryptographicallyValid &&
            evaluatedSignatures.length > 0;
        res.json({
            isValid,
            tamperDetected,
            documentId: document.id,
            currentDocumentHash: currentHash,
            signatures: evaluatedSignatures,
        });
    }
    catch (error) {
        console.error("Verify document signature error:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error?.message || "Failed to verify document signature",
        });
    }
}
/**
 * Handler for fetching a single signature by ID
 */
async function getSignatureByIdHandler(req, res) {
    const { id } = req.params;
    try {
        const signature = await prisma_1.default.digitalSignature.findUnique({
            where: { id },
            include: {
                signer: {
                    select: {
                        id: true,
                        fullName: true,
                        username: true,
                        email: true,
                        role: true,
                    },
                },
                document: {
                    select: {
                        id: true,
                        documentNumber: true,
                        title: true,
                        status: true,
                    },
                },
            },
        });
        if (!signature) {
            res.status(404).json({ error: "Signature not found" });
            return;
        }
        res.json(signature);
    }
    catch (error) {
        console.error("Get signature by ID error:", error);
        res.status(500).json({
            error: "Internal server error",
            message: error?.message || "Failed to fetch signature",
        });
    }
}
/**
 * @openapi
 * /api/documents/{id}/sign:
 *   post:
 *     summary: Ký số văn bản điện tử (Digital Signature)
 *     description: Thực hiện ký số (ký nháy, ký chính thức, đóng dấu trường) với tọa độ trực quan trên PDF, tính toán mã băm SHA-256 và lưu vết kiểm toán (audit trail).
 *     tags:
 *       - Signatures
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID văn bản cần ký số
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               signatureType:
 *                 type: string
 *                 enum: [INITIAL, OFFICIAL, STAMP]
 *                 default: OFFICIAL
 *                 description: Loại chữ ký (INITIAL - Ký nháy, OFFICIAL - Ký chính th���c, STAMP - Đóng dấu)
 *               pageNumber:
 *                 type: integer
 *                 default: 1
 *                 description: Trang ký trên file PDF
 *               coordX:
 *                 type: number
 *                 default: 0
 *                 description: Tọa độ X trên trang
 *               coordY:
 *                 type: number
 *                 default: 0
 *                 description: Tọa độ Y trên trang
 *               width:
 *                 type: number
 *                 default: 150
 *                 description: Chiều rộng khối chữ ký / con dấu
 *               height:
 *                 type: number
 *                 default: 60
 *                 description: Chiều cao khối chữ ký / con dấu
 *               signatureImage:
 *                 type: string
 *                 description: Ảnh con dấu/chữ ký dạng Base64 (tùy chọn)
 *               documentHash:
 *                 type: string
 *                 description: Mã băm SHA-256 của tài liệu tính sẵn (tùy chọn)
 *     responses:
 *       201:
 *         description: Ký số văn bản thành công
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc văn bản đã bị từ chối
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy văn bản
 *       500:
 *         description: Lỗi máy chủ
 */
exports.signatureRouter.post("/:id/sign", auth_middleware_1.requireAuth, security_middleware_1.signatureRateLimiter, signDocumentHandler);
exports.signatureRouter.post("/documents/:id/sign", auth_middleware_1.requireAuth, security_middleware_1.signatureRateLimiter, signDocumentHandler);
/**
 * @openapi
 * /api/documents/{id}/signatures:
 *   get:
 *     summary: Danh sách chữ ký số trên văn bản
 *     description: Lấy toàn bộ chữ ký điện tử đã được ký lên văn bản kèm thông tin chứng thư số và người ký.
 *     tags:
 *       - Signatures
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID văn bản
 *     responses:
 *       200:
 *         description: Danh sách chữ ký số thành công
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy văn bản
 *       500:
 *         description: Lỗi máy chủ
 */
exports.signatureRouter.get("/:id/signatures", auth_middleware_1.requireAuth, getDocumentSignaturesHandler);
exports.signatureRouter.get("/documents/:id/signatures", auth_middleware_1.requireAuth, getDocumentSignaturesHandler);
/**
 * @openapi
 * /api/documents/{id}/verify-signature:
 *   get:
 *     summary: Kiểm tra toàn vẹn và xác thực chữ ký số
 *     description: Đối soát mã băm toàn vẹn của văn bản hiện tại với các chữ ký đã đăng ký, phát hiện can thiệp chỉnh sửa trái phép (tamper detection).
 *     tags:
 *       - Signatures
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID văn bản cần kiểm tra tính toàn vẹn
 *       - in: query
 *         name: currentHash
 *         schema:
 *           type: string
 *         description: Mã băm hiện tại của tài liệu cần đối soát (tùy chọn)
 *       - in: query
 *         name: documentHash
 *         schema:
 *           type: string
 *         description: Tùy chọn alias cho currentHash
 *     responses:
 *       200:
 *         description: Kết quả kiểm tra toàn vẹn
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 isValid:
 *                   type: boolean
 *                 tamperDetected:
 *                   type: boolean
 *                 documentId:
 *                   type: string
 *                 signatures:
 *                   type: array
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy văn bản
 *       500:
 *         description: Lỗi máy chủ
 */
exports.signatureRouter.get("/:id/verify-signature", auth_middleware_1.requireAuth, verifyDocumentSignatureHandler);
exports.signatureRouter.get("/documents/:id/verify-signature", auth_middleware_1.requireAuth, verifyDocumentSignatureHandler);
/**
 * @openapi
 * /api/signatures/{id}:
 *   get:
 *     summary: Chi tiết một chữ ký số
 *     description: Lấy chi tiết thông tin chữ ký số theo ID chữ ký
 *     tags:
 *       - Signatures
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID chữ ký số
 *     responses:
 *       200:
 *         description: Chi tiết chữ ký
 *       401:
 *         description: Chưa xác thực
 *       404:
 *         description: Không tìm thấy chữ ký
 *       500:
 *         description: Lỗi máy chủ
 */
exports.signatureRouter.get("/:id", auth_middleware_1.requireAuth, getSignatureByIdHandler);
