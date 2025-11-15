import { Calendar, Hash, CheckCircle, AlertCircle, Info } from 'lucide-react';

export interface EntryResult {
  entryNumber: number;
  entryDate: string;
  entryContent: string;
  verification: {
    confidenceScore: number;
    summary: string;
    notes: string;
  };
}

interface EntryCardProps {
  entry: EntryResult;
}

export const EntryCard = ({ entry }: EntryCardProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return CheckCircle;
    if (score >= 60) return Info;
    return AlertCircle;
  };

  const ScoreIcon = getScoreIcon(entry.verification.confidenceScore);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <Hash className="w-4 h-4" />
            <span>{entry.entryNumber}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{entry.entryDate}</span>
          </div>
        </div>
        <div className={`flex items-center gap-2 font-bold text-lg ${getScoreColor(entry.verification.confidenceScore)}`}>
          <ScoreIcon className="w-5 h-5" />
          <span>%{entry.verification.confidenceScore}</span>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Entry İçeriği:
        </h3>
        <p className="text-gray-900 dark:text-gray-100 leading-relaxed">
          {entry.entryContent}
        </p>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Doğrulama Özeti:
        </h4>
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
          {entry.verification.summary}
        </p>
        {entry.verification.notes && (
          <div className="bg-gray-50 dark:bg-gray-900 rounded p-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              <span className="font-semibold">Not:</span> {entry.verification.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
