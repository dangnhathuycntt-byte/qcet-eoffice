import { DossierService } from "@/server/dossiers/dossier-service";
import { CloseDossierSchema } from "@qcet/contracts/dossiers";
import { dossierActionRoute } from "../shared";

export const POST = dossierActionRoute(CloseDossierSchema, (user, input) => DossierService.closeDossier(user, input));
