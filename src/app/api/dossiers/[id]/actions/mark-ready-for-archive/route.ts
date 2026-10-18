import { DossierService } from "@/server/dossiers/dossier-service";
import { DossierNotesActionSchema } from "@/contracts/dossiers";
import { dossierActionRoute } from "../shared";

export const POST = dossierActionRoute(DossierNotesActionSchema, (user, input) => DossierService.markReadyForArchive(user, input));
