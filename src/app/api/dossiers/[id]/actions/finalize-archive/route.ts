import { DossierService } from "@/lib/services/dossier-service";
import { FinalizeArchiveSchema } from "@/contracts/dossiers";
import { dossierActionRoute } from "../shared";

export const POST = dossierActionRoute(FinalizeArchiveSchema, (user, input) => DossierService.finalizeArchive(user, input));
