'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, Search, X } from 'lucide-react'
import { ConflictReport } from '@/components/conflicts/ConflictReport'
import { useConflicts } from '@/hooks/useConflicts'
import type { ConflictCheckResult } from '@/lib/conflicts/types'

export default function ConflictsPage() {
  const [clientName, setClientName] = useState('')
  const [adverseParties, setAdverseParties] = useState<string[]>([''])
  const [companyNames, setCompanyNames] = useState<string[]>([''])
  const [matterDescription, setMatterDescription] = useState('')
  const [result, setResult] = useState<ConflictCheckResult | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  const { runConflictCheck } = useConflicts()

  const addAdverseParty = () => {
    setAdverseParties([...adverseParties, ''])
  }

  const removeAdverseParty = (index: number) => {
    setAdverseParties(adverseParties.filter((_, i) => i !== index))
  }

  const updateAdverseParty = (index: number, value: string) => {
    const updated = [...adverseParties]
    updated[index] = value
    setAdverseParties(updated)
  }

  const addCompanyName = () => {
    setCompanyNames([...companyNames, ''])
  }

  const removeCompanyName = (index: number) => {
    setCompanyNames(companyNames.filter((_, i) => i !== index))
  }

  const updateCompanyName = (index: number, value: string) => {
    const updated = [...companyNames]
    updated[index] = value
    setCompanyNames(updated)
  }

  const handleRunCheck = async () => {
    setIsChecking(true)
    setResult(null)

    try {
      const checkResult = await runConflictCheck({
        clientName: clientName.trim() || undefined,
        adverseParties: adverseParties.filter((p) => p.trim().length > 0),
        companyNames: companyNames.filter((c) => c.trim().length > 0),
        matterDescription: matterDescription.trim() || undefined,
        saveResult: true,
      })

      setResult(checkResult)
    } catch (error) {
      console.error('Conflict check failed:', error)
    } finally {
      setIsChecking(false)
    }
  }

  const handleReset = () => {
    setClientName('')
    setAdverseParties([''])
    setCompanyNames([''])
    setMatterDescription('')
    setResult(null)
  }

  const isFormValid =
    clientName.trim().length > 0 ||
    adverseParties.some((p) => p.trim().length > 0) ||
    companyNames.some((c) => c.trim().length > 0) ||
    matterDescription.trim().length > 0

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Conflict of Interest Check</h1>
        <p className="text-muted-foreground">
          Search for potential conflicts across clients, adverse parties, and existing matters
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Check Parameters</CardTitle>
              <CardDescription>
                Enter information to search for conflicts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Client Name */}
              <div className="space-y-2">
                <Label htmlFor="clientName">Client Name</Label>
                <Input
                  id="clientName"
                  placeholder="Enter client or prospective client name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>

              {/* Adverse Parties */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Adverse Parties</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addAdverseParty}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {adverseParties.map((party, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Enter adverse party name"
                        value={party}
                        onChange={(e) => updateAdverseParty(index, e.target.value)}
                      />
                      {adverseParties.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAdverseParty(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Company Names */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Company Names</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCompanyName}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                <div className="space-y-2">
                  {companyNames.map((company, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="Enter company or organization name"
                        value={company}
                        onChange={(e) => updateCompanyName(index, e.target.value)}
                      />
                      {companyNames.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeCompanyName(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Matter Description */}
              <div className="space-y-2">
                <Label htmlFor="matterDescription">Matter Description</Label>
                <Textarea
                  id="matterDescription"
                  placeholder="Enter matter description or key facts to check for similar cases"
                  rows={4}
                  value={matterDescription}
                  onChange={(e) => setMatterDescription(e.target.value)}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleRunCheck}
                  disabled={!isFormValid || isChecking}
                  className="flex-1"
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Run Check
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  disabled={isChecking}
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {result ? (
            <ConflictReport result={result} />
          ) : (
            <Card className="h-full flex items-center justify-center min-h-[400px]">
              <CardContent className="text-center py-12">
                <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Results Yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Enter client information, adverse parties, or matter details and run a
                  conflict check to see results here
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
