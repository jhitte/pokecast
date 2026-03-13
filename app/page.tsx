'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Download, Loader2, Heart, Twitter, Copy, Sun, Moon, Trophy, Film } from 'lucide-react';
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

interface Movie {
  title: string;
  poster: string;
  overview: string;
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

const weatherToGenre: { [key: string]: number } = {
  clear: 28, cloudy: 18, fog: 9648, rain: 18, snow: 10751, thunder: 53
};

export default function Pokecast() {
  const [cityInput, setCityInput] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [flavorText, setFlavorText] = useState('');
  const [movie, setMovie] = useState<Movie | null>(null);
  const [caught, setCaught] = useState<CaughtPokemon[]>([]);
  const [showCollection, setShowCollection] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('light', savedTheme === 'light');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('light', newTheme === 'light');
  };

  const fetchWeather = async (lat: number, lon: number, cityName: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
      const data = await res.json();
      const conditionKey = weatherCodeMap[data.current.weather_code] || 'cloudy';
      const temp = Math.round(data.current.temperature_2m);

      setWeather({ temperature: temp, weatherCode: data.current.weather_code, city: cityName });

      // Pokémon
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

      // Groq AI
      const flavorRes = await fetch('/api/flavor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: cityName, temperature: temp, condition: conditionKey })
      });
      const flavorData = await flavorRes.json();
      setFlavorText(flavorData.flavor);

      // TODAY’S PERFECT MOVIE (TMDB)
      const genre = weatherToGenre[conditionKey];
      const movieRes = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&with_genres=${genre}&sort_by=popularity.desc`);
      const movieData = await movieRes.json();
      const first = movieData.results[0];
      setMovie({
        title: first.title,
        poster: `https://image.tmdb.org/t/p/w500${first.poster_path}`,
        overview: first.overview
      });
    } catch (err) {
      setError('Could not fetch weather. Try again!');
    }
    setLoading(false);
  };

  const searchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    let raw = cityInput.trim();
    if (!raw) return;
    const cityNameOnly = raw.split(/[, ]+/)[0];

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityNameOnly)}&count=5&language=en&format=json&countrycodes=US`);
      const data = await res.json();
      if (!data.results?.length) {
        setError('City not found!');
        setLoading(false);
        return;
      }
      const best = data.results[0];
      await fetchWeather(best.latitude, best.longitude, best.name);
    } catch {
      setError('Error searching city');
    }
    setLoading(false);
  };

  const getUserLocation = () => { /* your existing code */ };
  const catchPokemon = (p: Pokemon) => {
    const newCatch: CaughtPokemon = { ...p, date: new Date().toLocaleDateString(), city: weather!.city };
    setCaught(prev => [newCatch, ...prev.filter(c => c.name !== p.name)]);
  };

  const downloadCard = async () => { /* your existing code */ };
  const shareOnX = () => { /* your existing code */ };
  const copyLink = () => { /* your existing code */ };

  const personalLeaderboard = [...caught]
    .reduce((acc, p) => {
      const existing = acc.find(item => item.name === p.name);
      if (existing) existing.count++;
      else acc.push({ name: p.name, count: 1 });
      return acc;
    }, [] as {name: string; count: number}[])
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className={`min-h-screen overflow-hidden ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-white'}`}>
      {/* Header + Theme Toggle */}
      <div className="flex justify-between items-center pt-12 pb-8 px-6 max-w-5xl mx-auto">
        <div className="text-center flex-1">
          <h1 className="poke-title text-7xl font-bold text-yellow-400 tracking-widest">POKÉCAST</h1>
          <p className={`text-xl mt-2 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Weather where Pokémon roam free</p>
        </div>
        <button onClick={toggleTheme} className="p-3 rounded-full hover:bg-slate-800 transition">
          {theme === 'dark' ? <Sun size={28} /> : <Moon size={28} />}
        </button>
      </div>

      {/* Search */}
      <div className="max-w-2xl mx-auto px-6">
        <form onSubmit={searchCity} className="flex gap-3 mb-8">
          <input type="text" value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder="trenton ohio or tucson az" className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-yellow-400" />
          <button type="submit" disabled={loading} className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-8 rounded-2xl flex items-center gap-2"><Search size={20} /> Search</button>
        </form>
        <button onClick={getUserLocation} className="w-full bg-white/10 hover:bg-white/20 border border-white/30 py-4 rounded-2xl flex items-center justify-center gap-3 text-lg font-medium"><MapPin /> Use My Location</button>
      </div>

      {loading && <div className="text-center mt-12"><Loader2 className="animate-spin mx-auto text-6xl text-yellow-400" /><p className="mt-4 text-slate-400">Calling wild Pokémon...</p></div>}
      {error && <p className="text-red-400 text-center mt-6">{error}</p>}

      {weather && (
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className={`weather-bg bg-gradient-to-br ${typeColors[weatherCodeMap[weather.weatherCode] || 'cloudy']} rounded-3xl p-12 text-center shadow-2xl`}>
            <div id="catch-card" className="bg-slate-900 rounded-3xl p-10 border border-yellow-400/50">
              <h2 className="text-5xl font-bold">{weather.city}</h2>
              <div className="text-8xl my-6 font-bold text-yellow-400">{weather.temperature}°C / {Math.round(weather.temperature * 9/5 + 32)}°F</div>
              {flavorText && <p className="text-xl italic text-yellow-300 mb-8">"{flavorText}"</p>}
              <h3 className="text-3xl mb-8">Wild Pokémon sighted today!</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {pokemons.map((p, i) => (
                  <div key={i} className="relative">
                    <PokemonCard name={p.name} sprite={p.sprite} type={p.type} />
                    <button onClick={() => catchPokemon(p)} className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 px-3 py-1 rounded-full text-xs flex items-center gap-1"><Heart size={14} /> Catch!</button>
                  </div>
                ))}
              </div>
            </div>

            {/* TODAY’S PERFECT MOVIE */}
            {movie && (
              <div className="mt-10 bg-black/70 rounded-2xl p-8">
                <h3 className="flex items-center gap-3 justify-center text-2xl mb-4"><Film /> Today’s Perfect Movie</h3>
                <div className="flex flex-col md:flex-row gap-6 items-center">
                  <img src={movie.poster} alt={movie.title} className="w-48 rounded-xl shadow-xl" />
                  <div className="text-left">
                    <h4 className="text-3xl font-bold">{movie.title}</h4>
                    <p className="text-sm mt-3 line-clamp-4">{movie.overview}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-4 justify-center mt-10 flex-wrap">
              <button onClick={downloadCard} className="bg-white text-black font-bold px-8 py-4 rounded-2xl flex items-center gap-3 hover:scale-105"><Download /> Download Card</button>
              <button onClick={shareOnX} className="bg-[#1DA1F2] text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-3 hover:scale-105"><Twitter /> Tweet this Catch</button>
              <button onClick={copyLink} className="bg-slate-700 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-3 hover:scale-105"><Copy /> Copy Link</button>
              <button onClick={() => setShowLeaderboard(true)} className="bg-emerald-500 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-3 hover:scale-105"><Trophy /> Leaderboard</button>
            </div>

            <button onClick={() => setShowCollection(true)} className="mt-6 text-yellow-400 underline">👀 View My Pokédex ({caught.length} caught)</button>
          </div>
        </div>
      )}

      {/* Leaderboard Modal (personal top caught) */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-8">
            <h2 className="text-4xl mb-8 text-center flex items-center justify-center gap-3"><Trophy /> Your Leaderboard</h2>
            <div className="space-y-4">
              {personalLeaderboard.length ? personalLeaderboard.map((p, i) => (
                <div key={i} className="flex justify-between bg-slate-800 rounded-xl px-6 py-4">
                  <span className="font-bold">#{i+1} {p.name}</span>
                  <span className="text-yellow-400">{p.count} caught</span>
                </div>
              )) : <p className="text-center text-slate-400">Catch some Pokémon first!</p>}
            </div>
            <button onClick={() => setShowLeaderboard(false)} className="mt-8 mx-auto block bg-red-500 text-white px-10 py-4 rounded-2xl">Close</button>
          </div>
        </div>
      )}

      {/* My Pokédex Modal (same as before) */}
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