import { useState } from 'react';
import { ShieldCheck, Search, CheckCircle, XCircle, Ticket, AlertTriangle } from 'lucide-react';
import type { useTambola } from '@/hooks/useTambola';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { cn } from '@/lib/utils';
import { verifyDividend } from '@/lib/tambola';

interface SmartVerifierProps {
  tambola: ReturnType<typeof useTambola>;
}

const DIVIDEND_OPTIONS = [
  { value: 'early-five', label: 'Early Five' },
  { value: 'top-line', label: 'Top Line' },
  { value: 'middle-line', label: 'Middle Line' },
  { value: 'bottom-line', label: 'Bottom Line' },
  { value: 'corners', label: 'Corners' },
  { value: 'full-house', label: 'Full House' },
  { value: 'center', label: 'Center (Laddu)' },
  { value: 'pyramid', label: 'Pyramid' },
  { value: 'star', label: 'Star' },
  { value: 'plus', label: 'Plus' },
  { value: 'cross', label: 'Cross' },
];

export function SmartVerifier({ tambola }: SmartVerifierProps) {
  const [ticketId, setTicketId] = useState('');
  const [dividendType, setDividendType] = useState('');
  const [result, setResult] = useState<{ valid: boolean; reason: string } | null>(null);
  const [searchedTicket, setSearchedTicket] = useState<typeof tambola.sheets[0]['tickets'][0] | null>(null);
  const [verificationHistory, setVerificationHistory] = useState<Array<{
    id: string;
    ticketId: string;
    dividend: string;
    valid: boolean;
    timestamp: string;
  }>>([]);

  const { sheets, currentGame } = tambola;

  const handleVerify = () => {
    if (!ticketId.trim() || !dividendType) return;

    // Find ticket
    let ticket = null;
    for (const sheet of sheets) {
      ticket = sheet.tickets.find(t => t.id === ticketId.trim());
      if (ticket) break;
    }

    if (!ticket) {
      setResult({ valid: false, reason: 'Ticket not found in any sheet.' });
      setSearchedTicket(null);
      return;
    }

    setSearchedTicket(ticket);

    const calledNumbers = currentGame?.calledNumbers || [];
    
    if (calledNumbers.length === 0) {
      setResult({ valid: false, reason: 'No numbers have been called yet in the current game.' });
      return;
    }

    const isValid = verifyDividend(ticket, calledNumbers, dividendType);
    const dividendLabel = DIVIDEND_OPTIONS.find(d => d.value === dividendType)?.label || dividendType;
    
    const result = {
      valid: isValid,
      reason: isValid 
        ? `Valid claim! All required numbers for "${dividendLabel}" have been called.` 
        : `Invalid claim. Not all numbers for "${dividendLabel}" have been called yet, or the pattern doesn't match.`
    };
    
    setResult(result);
    
    setVerificationHistory(prev => [{
      id: `VER-${Date.now()}`,
      ticketId: ticketId.trim(),
      dividend: dividendLabel,
      valid: isValid,
      timestamp: new Date().toLocaleTimeString()
    }, ...prev].slice(0, 20));
  };

  const calledSet = new Set(currentGame?.calledNumbers || []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-amber-500" />
          Smart Verifier
        </h2>
        <p className="text-slate-500 mt-1">
          Instantly verify ticket claims. Enter the ticket ID and dividend type to check if the claim is valid.
        </p>
      </div>

      {/* Verification Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-500" />
            Verify a Claim
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ticket-id">Ticket ID</Label>
              <Input 
                id="ticket-id" 
                value={ticketId} 
                onChange={(e) => setTicketId(e.target.value)}
                placeholder="e.g., SHEET-0001-01"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Dividend Type</Label>
              <Select value={dividendType} onValueChange={setDividendType}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select dividend to verify" />
                </SelectTrigger>
                <SelectContent>
                  {DIVIDEND_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {currentGame?.calledNumbers.length === 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-lg text-amber-700 text-sm">
              <AlertTriangle className="w-4 h-4" />
              No numbers have been called in the current game yet.
            </div>
          )}
          
          <Button 
            onClick={handleVerify}
            disabled={!ticketId.trim() || !dividendType}
            className="bg-amber-500 hover:bg-amber-600 text-slate-900 gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Verify Claim
          </Button>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className={cn(
          'border-2',
          result.valid ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'
        )}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              {result.valid ? (
                <CheckCircle className="w-10 h-10 text-emerald-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-10 h-10 text-red-500 flex-shrink-0" />
              )}
              <div>
                <h3 className={cn(
                  'text-lg font-bold',
                  result.valid ? 'text-emerald-800' : 'text-red-800'
                )}>
                  {result.valid ? 'Valid Claim!' : 'Invalid Claim'}
                </h3>
                <p className={cn(
                  'mt-1',
                  result.valid ? 'text-emerald-700' : 'text-red-700'
                )}>
                  {result.reason}
                </p>
                {result.valid && (
                  <p className="text-sm text-emerald-600 mt-2">
                    Called numbers used: {currentGame?.calledNumbers.length || 0}/90
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ticket Preview */}
      {searchedTicket && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="w-5 h-5 text-blue-500" />
              Ticket Preview: {searchedTicket.id}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="inline-block">
              <div className="space-y-1">
                {searchedTicket.numbers.map((row, rIdx) => (
                  <div key={rIdx} className="flex gap-1">
                    {row.map((num, cIdx) => (
                      <div
                        key={cIdx}
                        className={cn(
                          'w-10 h-10 flex items-center justify-center text-sm font-bold rounded border',
                          num === null 
                            ? 'bg-slate-100 border-slate-200 text-slate-300' 
                            : calledSet.has(num)
                            ? 'bg-amber-100 border-amber-400 text-amber-800'
                            : 'bg-white border-slate-300 text-slate-800'
                        )}
                      >
                        {num !== null ? num : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-amber-100 border border-amber-400 rounded" />
                  <span className="text-slate-600">Called</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-white border border-slate-300 rounded" />
                  <span className="text-slate-600">Not Called</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Verification History */}
      {verificationHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Verifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {verificationHistory.map((v) => (
                <div key={v.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    {v.valid ? (
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{v.ticketId}</p>
                      <p className="text-xs text-slate-500">{v.dividend}</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400">{v.timestamp}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
