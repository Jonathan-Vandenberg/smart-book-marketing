type ProductApiConfig = {
  baseUrl: string
  secret: string
}

export class ProductApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "ProductApiError"
  }
}

function getProductApiConfig(): ProductApiConfig {
  const baseUrl = process.env.PRODUCT_API_URL?.trim()
  const secret = process.env.PRODUCT_ADMIN_SECRET?.trim()

  if (!baseUrl || !secret) {
    throw new ProductApiError(
      "PRODUCT_API_URL and PRODUCT_ADMIN_SECRET must be configured in .env.local",
      500,
    )
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    secret,
  }
}

async function productAdminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { baseUrl, secret } = getProductApiConfig()

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ProductApiError(
      typeof data.error === "string" ? data.error : `Product API error (${response.status})`,
      response.status,
    )
  }

  return data as T
}

export type FeatureCredit = {
  feature: string
  label: string
  credits: number
  description: string | null
  enabled: boolean
  updatedAt: string
}

export type ProductUser = {
  id: string
  email: string
  name: string | null
  plan: string
  aiBillingMode: string
  aiCreditsUsed: number
  aiCreditsLimit: number
  aiCreditsBonusBalance: number
  aiCreditsIncludedRemaining: number
  aiCreditsTotalRemaining: number
  aiCreditsResetAt: string | null
  subscriptionStatus: string | null
  currentPeriodEnd: string | null
  isComped: boolean
  createdAt: string
  usageLogCount: number
}

export type UsageLog = {
  id: string
  feature: string
  model: string | null
  promptTokens: number | null
  completionTokens: number | null
  creditsCharged: number
  keySource: string
  createdAt: string
}

export async function getFeatureCredits(): Promise<FeatureCredit[]> {
  const data = await productAdminFetch<{ features: FeatureCredit[] }>(
    "/api/admin/feature-credits",
  )
  return data.features
}

export async function updateFeatureCredit(input: {
  feature: string
  credits: number
  label?: string
  description?: string | null
  enabled?: boolean
}): Promise<FeatureCredit> {
  const data = await productAdminFetch<{ feature: FeatureCredit }>(
    "/api/admin/feature-credits",
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  )
  return data.feature
}

export async function listProductUsers(input?: {
  search?: string
  page?: number
  limit?: number
}): Promise<{
  users: ProductUser[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}> {
  const params = new URLSearchParams()
  if (input?.search) params.set("search", input.search)
  if (input?.page) params.set("page", String(input.page))
  if (input?.limit) params.set("limit", String(input.limit))

  const query = params.toString()
  return productAdminFetch(`/api/admin/users${query ? `?${query}` : ""}`)
}

export async function getProductUserDetail(userId: string): Promise<{
  user: ProductUser
  usageLogs: UsageLog[]
  usageByFeature: Array<{ feature: string; totalCredits: number; callCount: number }>
  creditPurchases: Array<{
    id: string
    packId: string
    creditsGranted: number
    amountZar: number
    status: string
    fulfilledAt: string | null
    createdAt: string
  }>
}> {
  return productAdminFetch(`/api/admin/users/${userId}`)
}

export function isProductApiConfigured(): boolean {
  return Boolean(process.env.PRODUCT_API_URL?.trim() && process.env.PRODUCT_ADMIN_SECRET?.trim())
}

export type HostedModel = {
  agent: string
  label: string
  modelId: string
  modelType: "chat" | "embeddings" | "tts" | "stt" | "images"
  updatedAt: string
}

export type OpenRouterModelOption = {
  id: string
  name: string
  description: string | null
}

export async function getHostedModels(): Promise<HostedModel[]> {
  const data = await productAdminFetch<{ models: HostedModel[] }>("/api/admin/hosted-models")
  return data.models
}

export async function updateHostedModel(input: {
  agent: string
  modelId: string
  label?: string
}): Promise<HostedModel> {
  const data = await productAdminFetch<{ model: HostedModel }>("/api/admin/hosted-models", {
    method: "PATCH",
    body: JSON.stringify(input),
  })
  return data.model
}

export async function getOpenRouterModels(
  type: HostedModel["modelType"],
): Promise<OpenRouterModelOption[]> {
  const data = await productAdminFetch<{ models: OpenRouterModelOption[] }>(
    `/api/admin/openrouter-models?type=${type}`,
  )
  return data.models
}
