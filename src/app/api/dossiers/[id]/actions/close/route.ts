import { DossierService } from "@/lib/services/dossier-service";
import { CloseDossierSchema } from "@/contracts/dossiers";
import { dossierActionRoute } from "../shared";

export const POST = dossierActionRoute(CloseDossierSchema, (user, input) => DossierService.closeDossier(user, input));
