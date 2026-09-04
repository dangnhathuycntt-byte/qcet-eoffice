"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSignatureHash = exports.generateCertificateInfo = exports.computeDocumentHash = exports.createVisualSignature = exports.pdfSignatureService = exports.PdfSignatureService = void 0;
exports.removeDiacritics = removeDiacritics;
const crypto_1 = __importDefault(require("crypto"));
const pdf_lib_1 = require("pdf-lib");
const client_1 = require("@prisma/client");
/**
 * Remove Vietnamese diacritics to ensure compatibility with StandardFonts (WinAnsi encoding)
 */
function removeDiacritics(str) {
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D");
}
class PdfSignatureService {
    /**
     * Embeds signature/stamp on PDF using pdf-lib or creates a new signed PDF buffer with text/stamp
     */
    async createVisualSignature(options) {
        const { pdfBuffer, signatureType = client_1.SignatureType.OFFICIAL, signerName, certificateSerial = "QCET-CERT-GENERIC", signedAt = new Date(), pageNumber = 1, coordX = 50, coordY = 50, width = 150, height = 60, signatureImage, } = options;
        let pdfDoc;
        if (pdfBuffer &&
            (Buffer.isBuffer(pdfBuffer)
                ? pdfBuffer.length > 0
                : pdfBuffer.byteLength > 0)) {
            pdfDoc = await pdf_lib_1.PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
        }
        else {
            pdfDoc = await pdf_lib_1.PDFDocument.create();
            pdfDoc.addPage([595.28, 841.89]); // A4 dimensions
        }
        if (pdfDoc.getPageCount() === 0) {
            pdfDoc.addPage([595.28, 841.89]);
        }
        const pageCount = pdfDoc.getPageCount();
        const targetPageIndex = Math.max(0, Math.min(pageNumber - 1, pageCount - 1));
        const page = pdfDoc.getPage(targetPageIndex);
        let imageEmbedded = false;
        if (signatureImage && signatureImage.trim() !== "") {
            try {
                const cleanedBase64 = signatureImage.replace(/^data:image\/[a-z]+;base64,/, "");
                const imageBytes = Buffer.from(cleanedBase64, "base64");
                let embeddedImage;
                try {
                    embeddedImage = await pdfDoc.embedPng(imageBytes);
                }
                catch {
                    embeddedImage = await pdfDoc.embedJpg(imageBytes);
                }
                if (embeddedImage) {
                    page.drawImage(embeddedImage, {
                        x: coordX,
                        y: coordY,
                        width,
                        height,
                    });
                    imageEmbedded = true;
                }
            }
            catch (err) {
                // If image embedding fails, fallback to vector text/stamp rendering
                imageEmbedded = false;
            }
        }
        if (!imageEmbedded) {
            const fontBold = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
            const fontRegular = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
            let borderColor = (0, pdf_lib_1.rgb)(0.12, 0.35, 0.7); // Default blue
            let bgColor = (0, pdf_lib_1.rgb)(0.96, 0.98, 1.0);
            let titleColor = (0, pdf_lib_1.rgb)(0.12, 0.35, 0.7);
            let title = "QCET DIGITAL SIGNATURE";
            let subtitle = `Signed by: ${removeDiacritics(signerName)}`;
            const typeStr = String(signatureType);
            if (typeStr === "STAMP") {
                borderColor = (0, pdf_lib_1.rgb)(0.85, 0.15, 0.15); // QCET Red Stamp
                bgColor = (0, pdf_lib_1.rgb)(1.0, 0.96, 0.96);
                titleColor = (0, pdf_lib_1.rgb)(0.85, 0.15, 0.15);
                title = "TRUONG CD KTCN QUANG NAM";
                subtitle = "[ DA DONG DAU - QCET ]";
            }
            else if (typeStr === "INITIAL") {
                borderColor = (0, pdf_lib_1.rgb)(0.35, 0.4, 0.45); // Slate / initial
                bgColor = (0, pdf_lib_1.rgb)(0.97, 0.98, 0.99);
                titleColor = (0, pdf_lib_1.rgb)(0.2, 0.25, 0.3);
                title = "KY NHAY / INITIAL";
                subtitle = `Initials: ${removeDiacritics(signerName)}`;
            }
            // Draw background card with border
            page.drawRectangle({
                x: coordX,
                y: coordY,
                width,
                height,
                borderColor,
                borderWidth: 1.5,
                color: bgColor,
                opacity: 0.92,
            });
            const safeDateStr = signedAt.toISOString().replace("T", " ").slice(0, 19);
            const safeSerial = certificateSerial.slice(0, 24);
            // Draw title
            page.drawText(title, {
                x: coordX + 8,
                y: coordY + height - 14,
                size: 8,
                font: fontBold,
                color: titleColor,
            });
            // Draw signer name / subtitle
            page.drawText(subtitle.slice(0, 32), {
                x: coordX + 8,
                y: coordY + height - 26,
                size: 7.5,
                font: fontRegular,
                color: (0, pdf_lib_1.rgb)(0.15, 0.15, 0.15),
            });
            // Draw cert serial
            page.drawText(`Serial: ${safeSerial}`, {
                x: coordX + 8,
                y: coordY + height - 38,
                size: 6.5,
                font: fontRegular,
                color: (0, pdf_lib_1.rgb)(0.35, 0.35, 0.35),
            });
            // Draw date
            page.drawText(`Date: ${safeDateStr} UTC`, {
                x: coordX + 8,
                y: coordY + 8,
                size: 6.5,
                font: fontRegular,
                color: (0, pdf_lib_1.rgb)(0.4, 0.4, 0.4),
            });
        }
        const savedBytes = await pdfDoc.save();
        return Buffer.from(savedBytes);
    }
    /**
     * Generates SHA-256 checksum for given string or buffer
     */
    computeDocumentHash(bufferOrString) {
        const hash = crypto_1.default.createHash("sha256");
        if (typeof bufferOrString === "string") {
            hash.update(bufferOrString, "utf8");
        }
        else {
            hash.update(bufferOrString);
        }
        return hash.digest("hex");
    }
    /**
     * Generates certificate serial (QCET-CERT-...) and owner info
     */
    generateCertificateInfo(user) {
        const userHash = crypto_1.default
            .createHash("sha256")
            .update(`${user.id}:${user.username || ""}:${user.email || ""}`)
            .digest("hex")
            .slice(0, 12)
            .toUpperCase();
        const certificateSerial = `QCET-CERT-${userHash}`;
        const ownerName = user.fullName || user.username || "User";
        const roleStr = user.role || "STAFF";
        const certificateOwner = `${ownerName} (${roleStr})`;
        return {
            certificateSerial,
            certificateOwner,
        };
    }
    /**
     * Computes cryptographic signature hash from document hash and signer identity
     */
    computeSignatureHash(params) {
        const signedAtIso = params.signedAt instanceof Date
            ? params.signedAt.toISOString()
            : new Date(params.signedAt).toISOString();
        const payload = `${params.documentHash}:${params.signerId}:${params.certificateSerial}:${signedAtIso}:${params.signatureType}`;
        return crypto_1.default.createHash("sha256").update(payload).digest("hex");
    }
}
exports.PdfSignatureService = PdfSignatureService;
exports.pdfSignatureService = new PdfSignatureService();
const createVisualSignature = (options) => exports.pdfSignatureService.createVisualSignature(options);
exports.createVisualSignature = createVisualSignature;
const computeDocumentHash = (bufferOrString) => exports.pdfSignatureService.computeDocumentHash(bufferOrString);
exports.computeDocumentHash = computeDocumentHash;
const generateCertificateInfo = (user) => exports.pdfSignatureService.generateCertificateInfo(user);
exports.generateCertificateInfo = generateCertificateInfo;
const computeSignatureHash = (params) => exports.pdfSignatureService.computeSignatureHash(params);
exports.computeSignatureHash = computeSignatureHash;
