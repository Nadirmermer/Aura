import { EntryCard, EntryResult } from './EntryCard';
import { AlertCircle } from 'lucide-react';

interface ResultsDisplayProps {
  results: EntryResult[];
  error?: string;
}

export const ResultsDisplay = ({ results, error }: ResultsDisplayProps) => {
  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-200">
              Bir Hata Oluştu
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Henüz analiz yapılmadı. Yukarıdaki formu kullanarak başlayın.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Analiz Sonuçları
        </h2>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {results.length} entry bulundu
        </span>
      </div>
      {results.map((entry, index) => (
        <EntryCard key={`${entry.entryNumber}-${index}`} entry={entry} />
      ))}
    </div>
  );
};
