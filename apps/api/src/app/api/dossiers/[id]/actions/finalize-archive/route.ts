import { DossierService } from "@/server/dossiers/dossier-service";
import { FinalizeArchiveSchema } from "@qcet/contracts/dossiers";
import { dossierActionRoute } from "../shared";

export const POST = dossierActionRoute(FinalizeArchiveSchema, (user, input) => DossierService.finalizeArchive(user, input));
