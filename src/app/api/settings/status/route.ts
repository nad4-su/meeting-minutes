import { isEnvKeyConfigured, isEnvProviderConfigured } from '@/lib/api-keys'

export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json({
    envConfigured: isEnvKeyConfigured(),
    envProviderConfigured: isEnvProviderConfigured(),
  })
}
