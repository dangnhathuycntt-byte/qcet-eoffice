import { NextRequest } from 'next/server';
import { getApiContext, requireAuthenticated } from '@/server/api/request-context';
import { apiError, apiSuccess } from '@/server/api/response';
import { AuthorizationError } from '@/server/api/errors';
import { parseAndValidateJson } from '@/server/api/validation';
import { loadAuthorizationContext } from '@/server/authorization/authorization-context-service';
import { isExecutivePosition } from '@/server/authorization/authorization-engine';
import type { AuthorizationContext } from '@/server/authorization/authorization-context';
import {
  CreateExecutiveResolutionSchema,
  ExecutiveResolutionQuerySchema,
} from '@qcet/contracts/executive';
import {
  toExecutiveResolutionDTO,
  toExecutiveResolutionDTOArray,
} from '@/server/dto/executive-dto';
import { assertCsrf } from '@/server/security/csrf';
import {
  createExecutiveResolution,
  listExecutiveResolutions,
} from '@/server/tasks/executive-resolution-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Canonical executive mandate gate (Issue #27 corrective review).
 *
 * Statutory executive authority derives EXCLUSIVELY from an active
 * executive PositionAssignment (Hiệu trưởng / Phó Hiệu trưởng / BGH),
 * evaluated through the canonical authorization context — NEVER from a
 * technical role string. In particular, technical `ADMIN`/`SYSTEM_ADMIN`
 * without an executive assignment is denied here (the canonical engine
 * additionally enforces separation-of-powers for system admins).
 */
function assertExecutiveMandate(authContext: AuthorizationContext): void {
  const hasMandate = authContext.positions.some((pos) => isExecutivePosition(pos.positionCode));
  if (!hasMandate) {
    throw new AuthorizationError(
      'Forbidden: Chỉ Ban Giám Hiệu (Hiệu trưởng / Phó Hiệu trưởng với phân công còn hiệu lực) mới có quyền truy cập nghị quyết/chỉ đạo điều hành'
    );
  }
}

export async function GET(request: NextRequest) {
  let requestId = 'req-exec-resolutions-get';
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    // Canonical authorization: statutory executive mandate from active
    // PositionAssignment (never a technical role string).
    const authContext = await loadAuthorizationContext(authUser.id);
    assertExecutiveMandate(authContext);

    const queryParams: Record<string, any> = {};
    request.nextUrl.searchParams.forEach((val, key) => {
      queryParams[key] = val;
    });

    const parsedQuery = ExecutiveResolutionQuerySchema.parse(queryParams);
    const { taskId, resolutionType, limit } = parsedQuery;
    const departmentId = parsedQuery.departmentId || parsedQuery.dept;

    const resolutions = await listExecutiveResolutions({
      taskId,
      resolutionType,
      departmentId,
      limit,
    });

    const dtos = toExecutiveResolutionDTOArray(resolutions);

    return apiSuccess(
      {
        resolutions: dtos,
        data: dtos,
        total: dtos.length,
      },
      {
        requestId,
        headers: {
          'Cache-Control': 'private, no-store',
        },
        legacyCompat: true,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}

export async function POST(request: NextRequest) {
  let requestId = 'req-exec-resolutions-post';
  try {
    const context = await getApiContext(request);
    requestId = context.requestId;
    requireAuthenticated(context);
    const authUser = context.user!;

    // Canonical authorization: statutory executive mandate from active
    // PositionAssignment (never a technical role string).
    const authContext = await loadAuthorizationContext(authUser.id);
    assertExecutiveMandate(authContext);

    assertCsrf(request);
    const validated = await parseAndValidateJson(request, CreateExecutiveResolutionSchema);

    const ifMatch = request.headers.get('if-match');
    let expectedVersion: number | undefined = validated.expectedVersion ?? validated.version;
    if (ifMatch && expectedVersion === undefined) {
      const cleanIfMatch = ifMatch.replace(/^"|"$/g, '').trim();
      const parsed = parseInt(cleanIfMatch, 10);
      if (!isNaN(parsed)) {
        expectedVersion = parsed;
      }
    }

    const result = await createExecutiveResolution({
      authContext,
      authUser,
      input: validated,
      expectedVersion,
      requestId,
    });

    const dto = toExecutiveResolutionDTO(result.resolution);

    return apiSuccess(
      {
        resolution: dto,
        data: dto,
        task: result.updatedTask,
      },
      {
        requestId,
        headers: {
          'Cache-Control': 'private, no-store',
          ETag: `"${result.updatedTask.version}"`,
        },
        legacyCompat: true,
      }
    );
  } catch (error) {
    return apiError(error, requestId, { legacyCompat: true });
  }
}
