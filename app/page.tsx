'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Download, Loader2, Heart, Twitter, Copy } from 'lucide-react';
import html2canvas from 'html2canvas';
import PokemonCard from './components/PokemonCard';

interface WeatherData {
  temperature: number;
  weatherCode: number;
  city: string;
}

interface Pokemon {
  name: string;
  sprite: string;
  type: string;
}

interface CaughtPokemon extends Pokemon {
  date: string;
  city: string;
}

const weatherCodeMap: { [key: number]: string } = {
  0: 'clear', 1: 'clear', 2: 'cloudy', 3: 'cloudy',
  45: 'fog', 48: 'fog',
  51: 'rain', 53: 'rain', 55: 'rain',
  61: 'rain', 63: 'rain', 65: 'rain',
  71: 'snow', 73: 'snow', 75: 'snow',
  77: 'snow',
  80: 'rain', 81: 'rain', 82: 'rain',
  85: 'snow', 86: 'snow',
  95: 'thunder', 96: 'thunder', 99: 'thunder'
};

const typeColors: { [key: string]: string } = {
  clear: 'from-yellow-400 to-orange-500',
  cloudy: 'from-slate-400 to-gray-600',
  fog: 'from-blue-300 to-slate-500',
  rain: 'from-blue-500 to-cyan-600',
  snow: 'from-sky-200 to-blue-400',
  thunder: 'from-purple-600 to-violet-700'
};

const typeToPokemonTypes: { [key: string]: string[] } = {
  clear: ['fire', 'grass'],
  cloudy: ['normal', 'flying'],
  fog: ['ghost', 'psychic'],
  rain: ['water', 'electric'],
  snow: ['ice'],
  thunder: ['electric', 'dragon']
};

export default function Pokecast() {
  const [cityInput, setCityInput] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [flavorText, setFlavorText] = useState('');
  const [caught, setCaught] = useState<CaughtPokemon[]>([]);
  const [showCollection, setShowCollection] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load/Save collection
  useEffect(() => {
    const saved = localStorage.getItem('pokecast-collection');
    if (saved) setCaught(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('pokecast-collection', JSON.stringify(caught));
  }, [caught]);

  const fetchWeather = async (lat: number, lon: number, cityName: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
      const data = await res.json();
      
      const conditionKey = weatherCodeMap[data.current.weather_code] || 'cloudy';
      const temp = Math.round(data.current.temperature_2m);

      setWeather({ temperature: temp, weatherCode: data.current.weather_code, city: cityName });

      // Get Pokémon
      const types = typeToPokemonTypes[conditionKey];
      const allPokemon: Pokemon[] = [];
      for (const t of types) {
        const typeRes = await fetch(`https://pokeapi.co/api/v2/type/${t}`);
        const typeData = await typeRes.json();
        const randoms = typeData.pokemon.sort(() => 0.5 - Math.random()).slice(0, 2);
        for (const p of randoms) {
          const pokeRes = await fetch(p.pokemon.url);
          const pokeData = await pokeRes.json();
          allPokemon.push({ name: pokeData.name, sprite: pokeData.sprites.front_default, type: t });
        }
      }
      setPokemons(allPokemon.slice(0, 4));

      // Groq AI flavor text
      const flavorRes = await fetch('/api/flavor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: cityName, temperature: temp, condition: conditionKey })
      });
      const flavorData = await flavorRes.json();
      setFlavorText(flavorData.flavor);
    } catch (err) {
      setError('Could not fetch weather. Try again!');
    }
    setLoading(false);
  };

  // 🔥 IMPROVED SEARCH - handles EVERY Franklin variation perfectly
  const searchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    let query = cityInput.trim();
    if (!query) return;

    // Clean input: remove commas, extra spaces, make it flexible
    query = query.replace(/,/g, ' ').replace(/\s+/g, ' ');

    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json&countrycodes=US`
      );
      const data = await res.json();
      
      if (!data.results?.length) {
        setError('City not found! Try another name.');
        setLoading(false);
        return;
      }
      
      const best = data.results[0]; // API ranks best match first
      await fetchWeather(best.latitude, best.longitude, best.name);
    } catch {
      setError('Error searching city');
    }
    setLoading(false);
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) return setError('Geolocation not supported');
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&count=1&language=en&format=json`);
        const data = await res.json();
        const cityName = data.results?.[0]?.name || 'Your Location';
        await fetchWeather(pos.coords.latitude, pos.coords.longitude, cityName);
      },
      () => setError('Location access denied')
    );
  };

  const catchPokemon = (p: Pokemon) => {
    const newCatch: CaughtPokemon = { ...p, date: new Date().toLocaleDateString(), city: weather!.city };
    setCaught(prev => [newCatch, ...prev.filter(c => c.name !== p.name)]);
  };

  const downloadCard = async () => {
    const element = document.getElementById('catch-card');
    if (!element || !weather) return;
    const canvas = await html2canvas(element, { scale: 3, backgroundColor: '#1f2937' });
    const link = document.createElement('a');
    link.download = `pokecast-${weather.city}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const shareOnX = () => {
    const text = `Just caught wild Pokémon in ${weather?.city} on PokéCast! ${flavorText} → https://pokecast-alpha.vercel.app`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const copyLink = () => {
    navigator.clipboard.writeText('https://pokecast-alpha.vercel.app');
    alert('✅ Link copied!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      <div className="text-center pt-12 pb-8">
        <h1 className="poke-title text-7xl font-bold text-yellow-400 tracking-widest">POKÉCAST</h1>
        <p className="text-xl mt-2 text-slate-400">Weather where Pokémon roam free</p>
      </div>

      <div className="max-w-2xl mx-auto px-6">
        <form onSubmit={searchCity} className="flex gap-3 mb-8">
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            placeholder="Franklin, Ohio or franklin oh or franklin"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-yellow-400"
          />
          <button type="submit" disabled={loading} className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-8 rounded-2xl flex items-center gap-2">
            <Search size={20} /> Search
          </button>
        </form>

        <button onClick={getUserLocation} className="w-full bg-white/10 hover:bg-white/20 border border-white/30 py-4 rounded-2xl flex items-center justify-center gap-3 text-lg font-medium">
          <MapPin /> Use My Location
        </button>
      </div>

      {loading && <div className="text-center mt-12"><Loader2 className="animate-spin mx-auto text-6xl text-yellow-400" /><p className="mt-4 text-slate-400">Calling wild Pokémon...</p></div>}
      {error && <p className="text-red-400 text-center mt-6">{error}</p>}

      {weather && (
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className={`weather-bg bg-gradient-to-br ${typeColors[weatherCodeMap[weather.weatherCode] || 'cloudy']} rounded-3xl p-12 text-center shadow-2xl`}>
            <div id="catch-card" className="bg-slate-900 rounded-3xl p-10 border border-yellow-400/50">
              <h2 className="text-5xl font-bold">{weather.city}</h2>
              <div className="text-8xl my-6 font-bold text-yellow-400">
                {weather.temperature}°C / {Math.round(weather.temperature * 9/5 + 32)}°F
              </div>

              {flavorText && <p className="text-xl italic text-yellow-300 mb-8 max-w-2xl mx-auto">"{flavorText}"</p>}

              <h3 className="text-3xl mb-8">Wild Pokémon sighted today!</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {pokemons.map((p, i) => (
                  <div key={i} className="relative">
                    <PokemonCard name={p.name} sprite={p.sprite} type={p.type} />
                    <button onClick={() => catchPokemon(p)} className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 px-3 py-1 rounded-full text-xs flex items-center gap-1">
                      <Heart size={14} /> Catch!
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 justify-center mt-10 flex-wrap">
              <button onClick={downloadCard} className="bg-white text-black font-bold px-8 py-4 rounded-2xl flex items-center gap-3 hover:scale-105"><Download /> Download Card</button>
              <button onClick={shareOnX} className="bg-[#1DA1F2] text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-3 hover:scale-105"><Twitter /> Share on X</button>
              <button onClick={copyLink} className="bg-slate-700 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-3 hover:scale-105"><Copy /> Copy Link</button>
            </div>

            <button onClick={() => setShowCollection(true)} className="mt-6 text-yellow-400 underline">👀 View My Pokédex ({caught.length} caught)</button>
          </div>
        </div>
      )}

      {showCollection && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-auto p-8">
            <h2 className="text-4xl mb-8 text-center">My Pokédex</h2>
            {caught.length ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {caught.map((p, i) => <PokemonCard key={i} name={p.name} sprite={p.sprite} type={p.type} />)}
              </div>
            ) : <p className="text-center text-slate-400">No Pokémon caught yet!</p>}
            <button onClick={() => setShowCollection(false)} className="mt-8 mx-auto block bg-red-500 text-white px-10 py-4 rounded-2xl">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}