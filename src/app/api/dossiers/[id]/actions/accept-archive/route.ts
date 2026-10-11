import { DossierService } from "@/lib/services/dossier-service";
import { AcceptArchiveSchema } from "@/contracts/dossiers";
import { dossierActionRoute } from "../shared";

export const POST = dossierActionRoute(AcceptArchiveSchema, (user, input) => DossierService.acceptArchive(user, input));
