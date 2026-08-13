"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { FeatureCredit } from "@/lib/product-api"

export function CreditsEditor({ features }: { features: FeatureCredit[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function saveFeature(feature: string, form: HTMLFormElement) {
    setSaving(feature)
    setError(null)

    const formData = new FormData(form)
    const credits = Number.parseInt(String(formData.get("credits")), 10)
    const label = String(formData.get("label") ?? "").trim()
    const description = String(formData.get("description") ?? "").trim()
    const enabled = formData.get("enabled") === "on"

    try {
      const response = await fetch("/api/admin/feature-credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feature,
          credits,
          label: label || undefined,
          description: description || null,
          enabled,
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
            <th>Feature</th>
            <th>Label</th>
            <th>Credits</th>
            <th>Description</th>
            <th>Enabled</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {features.map((feature) => (
            <tr key={feature.feature}>
              <td>
                <code>{feature.feature}</code>
              </td>
              <td colSpan={4}>
                <form
                  id={`form-${feature.feature}`}
                  className="inline-actions"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void saveFeature(feature.feature, event.currentTarget)
                  }}
                >
                  <input
                    name="label"
                    defaultValue={feature.label}
                    style={{ minWidth: "10rem" }}
                  />
                  <input
                    name="credits"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={feature.credits}
                    style={{ width: "5rem" }}
                  />
                  <input
                    name="description"
                    defaultValue={feature.description ?? ""}
                    placeholder="Description"
                    style={{ minWidth: "14rem", flex: 1 }}
                  />
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                    <input
                      name="enabled"
                      type="checkbox"
                      defaultChecked={feature.enabled}
                    />
                    On
                  </label>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={saving === feature.feature}
                  >
                    {saving === feature.feature ? "Saving…" : "Save"}
                  </button>
                </form>
              </td>
              <td className="muted" style={{ fontSize: "0.8rem" }}>
                {new Date(feature.updatedAt).toLocaleString("en-ZA")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
