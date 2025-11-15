export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, query } = req.body;

  if (!url || !query) {
    return res.status(400).json({ error: 'URL and query are required' });
  }

  try {
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const googleSearchApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!firecrawlApiKey || !geminiApiKey || !googleSearchApiKey || !googleSearchEngineId) {
      return res.status(500).json({
        status: 'error',
        message: 'API anahtarları yapılandırılmamış',
      });
    }

    const scrapedData = await scrapeContent(url, firecrawlApiKey);

    if (!scrapedData) {
      return res.status(500).json({
        status: 'error',
        message: 'İçerik çekilemedi. Lütfen URL\'yi kontrol edin.',
      });
    }

    const relevantEntries = await filterRelevantEntries(scrapedData, query, geminiApiKey);

    if (!relevantEntries || relevantEntries.length === 0) {
      return res.status(200).json({
        status: 'empty',
        message: 'İlgili bir entry bulunamadı.',
        results: [],
      });
    }

    const verifiedResults = await verifyEntries(
      relevantEntries,
      geminiApiKey,
      googleSearchApiKey,
      googleSearchEngineId
    );

    return res.status(200).json({
      status: 'success',
      results: verifiedResults,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Analiz sırasında bir hata oluştu',
    });
  }
}

async function scrapeContent(url, apiKey) {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        formats: ['markdown'],
      }),
    });

    if (!response.ok) {
      console.error('Firecrawl error:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    return data.markdown || data.content || null;
  } catch (error) {
    console.error('Scraping error:', error);
    return null;
  }
}

async function filterRelevantEntries(scrapedData, query, apiKey) {
  try {
    const prompt = `Sana bir Ekşi Sözlük başlığından alınmış şu metin yığınını veriyorum:

${scrapedData}

Kullanıcının aradığı şey şu: "${query}"

Lütfen bu metin yığını içinde SADECE bu soruya yanıt verebilecek veya bu konuyla doğrudan ilgili olan entry'leri bul. Bulduğun her ilgili entry için bana şu formatta bir JSON listesi ver:

[
  {
    "entryContent": "entry'nin tam metni",
    "entryNumber": 12345,
    "entryDate": "GG.AA.YYYY"
  }
]

SADECE JSON formatında yanıt ver. Başka hiçbir açıklama ekleme.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Gemini filter error:', response.status);
      return [];
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return [];
    }

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Filter error:', error);
    return [];
  }
}

async function verifyEntries(entries, geminiApiKey, googleApiKey, searchEngineId) {
  const results = [];

  for (const entry of entries) {
    try {
      const claim = await extractClaim(entry.entryContent, geminiApiKey);

      if (!claim) {
        results.push({
          entryNumber: entry.entryNumber,
          entryDate: entry.entryDate,
          entryContent: entry.entryContent,
          verification: {
            confidenceScore: 0,
            summary: 'İddia çıkarılamadı',
            notes: 'Entry içeriğinden ana iddia belirlenemedi',
          },
        });
        continue;
      }

      const searchResults = await searchForVerification(
        claim.claim,
        claim.eventDate,
        googleApiKey,
        searchEngineId
      );

      const verification = await scoreVerification(
        entry.entryContent,
        searchResults,
        geminiApiKey
      );

      results.push({
        entryNumber: entry.entryNumber,
        entryDate: entry.entryDate,
        entryContent: entry.entryContent,
        verification: verification || {
          confidenceScore: 0,
          summary: 'Doğrulama yapılamadı',
          notes: 'Yeterli kaynak bulunamadı',
        },
      });
    } catch (error) {
      console.error('Verification error for entry:', entry.entryNumber, error);
      results.push({
        entryNumber: entry.entryNumber,
        entryDate: entry.entryDate,
        entryContent: entry.entryContent,
        verification: {
          confidenceScore: 0,
          summary: 'Doğrulama sırasında hata oluştu',
          notes: 'Teknik bir sorun nedeniyle doğrulama tamamlanamadı',
        },
      });
    }
  }

  return results;
}

async function extractClaim(entryContent, apiKey) {
  try {
    const prompt = `Bu entry'yi analiz et:

"${entryContent}"

Bu entry'deki ana iddia nedir ve bu iddianın geçtiği OLAY TARİHİ nedir? Bana şu JSON formatında bir yanıt ver:

{
  "claim": "ana iddia",
  "eventDate": "YYYY-MM-DD"
}

Not: Olay tarihi, entry'nin yazıldığı tarih değil, bahsettiği olayın tarihidir. Eğer kesin bir tarih yoksa, en yakın yıl veya dönemi belirt.

SADECE JSON formatında yanıt ver.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return null;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Claim extraction error:', error);
    return null;
  }
}

async function searchForVerification(claim, eventDate, apiKey, searchEngineId) {
  try {
    const eventYear = new Date(eventDate).getFullYear();
    const startYear = eventYear - 1;
    const endYear = eventYear + 1;

    const searchQuery = `${claim} ${eventYear}`;

    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.append('key', apiKey);
    url.searchParams.append('cx', searchEngineId);
    url.searchParams.append('q', searchQuery);
    url.searchParams.append('dateRestrict', `y${endYear - startYear}`);
    url.searchParams.append('num', '10');

    const response = await fetch(url.toString());

    if (!response.ok) {
      console.error('Google Search error:', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.items) {
      return [];
    }

    return data.items.map((item) => ({
      title: item.title,
      snippet: item.snippet,
      link: item.link,
    }));
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

async function scoreVerification(entryContent, searchResults, apiKey) {
  try {
    const sourcesText = searchResults
      .map(
        (result, index) =>
          `${index + 1}. ${result.title}\n   ${result.snippet}\n   Kaynak: ${result.link}`
      )
      .join('\n\n');

    const prompt = `Bir teyitçisin. Orijinal iddia şu:

"${entryContent}"

Bu iddiayı desteklemek veya çürütmek için o döneme ait şu kaynakları buldum:

${sourcesText}

Bu kaynaklara dayanarak, orijinal iddianın doğruluk payı nedir? Bana %0-100 arası bir güven skoru ver, bulgularını özetleyen kısa bir teyit özeti yaz ve varsa ek notlarını (çelişkiler, emin olamadığın noktalar) belirt.

Yanıtını şu JSON formatında ver:

{
  "confidenceScore": 85,
  "summary": "kısa özet",
  "notes": "ek notlar"
}

SADECE JSON formatında yanıt ver.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return null;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Scoring error:', error);
    return null;
  }
}
