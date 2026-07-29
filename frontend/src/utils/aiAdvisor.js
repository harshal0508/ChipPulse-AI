// AI Advisor module for simulating Gemini API responses during development.
// This is structured to easily drop in the real Gemini API later.

export const askGeminiAI = async (componentData, temperature) => {
  try {
    const res = await fetch('/api/v1/advisor/component', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        component: componentData,
        temperature: temperature
      })
    });
    
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    return data.advice;
  } catch (e) {
    console.error('Gemini error:', e);
    return `Fallback: Operating at ${temperature.toFixed(1)}°C. Check layout.`;
  }
};

// Layout AI Analysis for the entire board
export const analyzeBoard = async (components, maxTemp, score) => {
  try {
    const res = await fetch('/api/v1/advisor/board', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        components,
        max_temp: maxTemp,
        score
      })
    });

    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    return data.advice;
  } catch (e) {
    console.error('Gemini error:', e);
    return "Fallback: Could not reach Gemini AI. Try adjusting high-power components.";
  }
};
