import { DossierService } from "@/lib/services/dossier-service";
import { RejectArchiveSchema } from "@/contracts/dossiers";
import { dossierActionRoute } from "../shared";

export const POST = dossierActionRoute(RejectArchiveSchema, (user, input) => DossierService.rejectArchive(user, input));
