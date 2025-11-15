import { useState } from 'react';
import { Header } from '../components/Header';
import { SearchForm } from '../components/SearchForm';
import { ResultsDisplay } from '../components/ResultsDisplay';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EntryResult } from '../components/EntryCard';

export const HomePage = () => {
  const [results, setResults] = useState<EntryResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleAnalyze = async (url: string, query: string) => {
    setIsLoading(true);
    setError(undefined);
    setResults([]);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, query }),
      });

      if (!response.ok) {
        throw new Error('Analiz sırasında bir hata oluştu');
      }

      const data = await response.json();

      if (data.status === 'success') {
        setResults(data.results);
      } else {
        throw new Error(data.error || 'Bilinmeyen bir hata oluştu');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Bir hata oluştu'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-8 transition-colors">
          <SearchForm onSubmit={handleAnalyze} isLoading={isLoading} />
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <ResultsDisplay results={results} error={error} />
        )}
      </main>
    </div>
  );
};
