"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { HostedModel, OpenRouterModelOption } from "@/lib/product-api"

export function ModelsEditor({ models }: { models: HostedModel[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [optionsByType, setOptionsByType] = useState<
    Partial<Record<HostedModel["modelType"], OpenRouterModelOption[]>>
  >({})
  const [loadingTypes, setLoadingTypes] = useState<Set<HostedModel["modelType"]>>(new Set())

  const uniqueTypes = useMemo(
    () => [...new Set(models.map((model) => model.modelType))],
    [models],
  )

  const typeKey = uniqueTypes.join("|")

  useEffect(() => {
    let cancelled = false

    async function loadModelsForType(type: HostedModel["modelType"]) {
      setLoadingTypes((prev) => new Set(prev).add(type))
      try {
        const response = await fetch(`/api/admin/openrouter-models?type=${type}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error ?? "Failed to load OpenRouter models")
        }
        if (!cancelled) {
          setOptionsByType((prev) => ({
            ...prev,
            [type]: data.models as OpenRouterModelOption[],
          }))
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load OpenRouter models")
        }
      } finally {
        if (!cancelled) {
          setLoadingTypes((prev) => {
            const next = new Set(prev)
            next.delete(type)
            return next
          })
        }
      }
    }

    for (const type of uniqueTypes) {
      void loadModelsForType(type)
    }

    return () => {
      cancelled = true
    }
  }, [typeKey, uniqueTypes])

  async function saveModel(agent: string, form: HTMLFormElement) {
    setSaving(agent)
    setError(null)

    const formData = new FormData(form)
    const modelId = String(formData.get("modelId") ?? "").trim()
    const label = String(formData.get("label") ?? "").trim()

    try {
      const response = await fetch("/api/admin/hosted-models", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent,
          modelId,
          label: label || undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error ?? "Save failed")
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(null)
    }
  }

  function renderOptions(model: HostedModel) {
    const options = optionsByType[model.modelType] ?? []
    const ids = new Set(options.map((option) => option.id))
    const items = [...options]

    if (model.modelId && !ids.has(model.modelId)) {
      items.unshift({
        id: model.modelId,
        name: `${model.modelId} (current)`,
        description: null,
      })
    }

    if (loadingTypes.has(model.modelType) && items.length === 0) {
      return <option value={model.modelId}>Loading OpenRouter models…</option>
    }

    if (items.length === 0) {
      return (
        <>
          <option value={model.modelId}>{model.modelId}</option>
          <option value="" disabled>
            No models returned — check PLATFORM_OPENROUTER_API_KEY
          </option>
        </>
      )
    }

    return items.map((option) => (
      <option key={option.id} value={option.id}>
        {option.name} ({option.id})
      </option>
    ))
  }

  return (
    <div>
      {error && (
        <p className="muted" style={{ color: "#c62828", marginBottom: "1rem" }}>
          {error}
        </p>
      )}

      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Label</th>
            <th>OpenRouter model</th>
            <th>Type</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {models.map((model) => (
            <tr key={model.agent}>
              <td>
                <code>{model.agent}</code>
              </td>
              <td colSpan={3}>
                <form
                  className="inline-actions"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void saveModel(model.agent, event.currentTarget)
                  }}
                >
                  <input
                    name="label"
                    defaultValue={model.label}
                    style={{ minWidth: "10rem" }}
                  />
                  <select
                    name="modelId"
                    defaultValue={model.modelId}
                    style={{ minWidth: "20rem", maxWidth: "28rem" }}
                  >
                    {renderOptions(model)}
                  </select>
                  <span className="badge">{model.modelType}</span>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={saving === model.agent}
                  >
                    {saving === model.agent ? "Saving…" : "Save"}
                  </button>
                </form>
              </td>
              <td className="muted" style={{ fontSize: "0.8rem" }}>
                {new Date(model.updatedAt).toLocaleString("en-ZA")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
