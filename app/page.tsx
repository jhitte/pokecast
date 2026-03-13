'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Download, Loader2, Heart, Twitter, Copy, Sun, Moon, Trophy, Film } from 'lucide-react';
import html2canvas from 'html2canvas';
import PokemonCard from './components/PokemonCard';
import { kv } from '@vercel/kv';

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

const weatherCodeMap: { [key: number]: string } = { /* same as before */ };
const typeColors: { [key: string]: string } = { /* same as before */ };
const typeToPokemonTypes: { [key: string]: string[] } = { /* same as before */ };

const weatherToGenre: { [key: string]: number } = {
  clear: 28,   // Action
  cloudy: 18,  // Drama
  fog: 9648,   // Mystery
  rain: 18,    // Drama
  snow: 10751, // Family
  thunder: 53  // Thriller
};

export default function Pokecast() {
  const [cityInput, setCityInput] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [flavorText, setFlavorText] = useState('');
  const [movie, setMovie] = useState<Movie | null>(null);
  const [caught, setCaught] = useState<CaughtPokemon[]>([]);
  const [leaderboard, setLeaderboard] = useState<{name: string; count: number}[]>([]);
  const [showCollection, setShowCollection] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Theme
  useEffect(() => {
    const saved = localStorage.getItem('theme') as 'dark' | 'light' || 'dark';
    setTheme(saved);
    document.documentElement.classList.toggle('light', saved === 'light');
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
      // Open-Meteo weather
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
      const data = await res.json();
      const conditionKey = weatherCodeMap[data.current.weather_code] || 'cloudy';
      const temp = Math.round(data.current.temperature_2m);

      setWeather({ temperature: temp, weatherCode: data.current.weather_code, city: cityName });

      // Pokémon (same as before)
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

      // Groq AI flavor
      const flavorRes = await fetch('/api/flavor', { /* same POST as before */ });
      const flavorData = await flavorRes.json();
      setFlavorText(flavorData.flavor);

      // TMDB Perfect Movie
      const genre = weatherToGenre[conditionKey];
      const movieRes = await fetch(
        `https://api.themoviedb.org/3/discover/movie?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&with_genres=${genre}&sort_by=popularity.desc&page=1`
      );
      const movieData = await movieRes.json();
      const firstMovie = movieData.results[0];
      setMovie({
        title: firstMovie.title,
        poster: `https://image.tmdb.org/t/p/w500${firstMovie.poster_path}`,
        overview: firstMovie.overview
      });
    } catch (err) {
      setError('Could not fetch weather. Try again!');
    }
    setLoading(false);
  };

  // Search (your fixed version)
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

  // Catch + Global Leaderboard update
  const catchPokemon = async (p: Pokemon) => {
    const newCatch: CaughtPokemon = { ...p, date: new Date().toLocaleDateString(), city: weather!.city };
    setCaught(prev => [newCatch, ...prev.filter(c => c.name !== p.name)]);

    // Global KV update
    try {
      await kv.hincrby('pokemon-leaderboard', p.name.toLowerCase(), 1);
      fetchLeaderboard();
    } catch (e) {
      console.log('KV update failed (local only)');
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const data = await kv.hgetall('pokemon-leaderboard') || {};
      const sorted = Object.entries(data)
        .map(([name, count]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), count: Number(count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      setLeaderboard(sorted);
    } catch {
      setLeaderboard([]);
    }
  };

  // Rest of functions (downloadCard, shareOnX, copyLink, getUserLocation) stay exactly as your last version

  return (
    <div className={`min-h-screen overflow-hidden ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-white'}`}>
      {/* Header with theme toggle */}
      <div className="flex justify-between items-center pt-12 pb-8 px-6 max-w-5xl mx-auto">
        <div className="text-center flex-1">
          <h1 className="poke-title text-7xl font-bold text-yellow-400 tracking-widest">POKÉCAST</h1>
          <p className={`text-xl mt-2 ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>Weather where Pokémon roam free</p>
        </div>
        <button onClick={toggleTheme} className="p-3 rounded-full hover:bg-slate-800 transition">
          {theme === 'dark' ? <Sun size={28} /> : <Moon size={28} />}
        </button>
      </div>

      {/* Search, Loading, Error, Weather Card — same as your last version */}

      {weather && (
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className={`weather-bg bg-gradient-to-br ${typeColors[weatherCodeMap[weather.weatherCode] || 'cloudy']} rounded-3xl p-12 text-center shadow-2xl`}>
            {/* Catch Card + AI text + Catch buttons (same) */}

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

            {/* Share buttons + new Global Leaderboard button */}
            <div className="flex gap-4 justify-center mt-10 flex-wrap">
              {/* Download, Tweet this Catch, Copy Link (same) */}
              <button onClick={() => setShowLeaderboard(true)} className="bg-emerald-500 text-white font-bold px-8 py-4 rounded-2xl flex items-center gap-3 hover:scale-105">
                <Trophy /> Global Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 rounded-3xl max-w-md w-full p-8">
            <h2 className="text-4xl mb-8 text-center flex items-center justify-center gap-3"><Trophy /> Global Leaderboard</h2>
            <div className="space-y-4">
              {leaderboard.length ? leaderboard.map((p, i) => (
                <div key={i} className="flex justify-between bg-slate-800 rounded-xl px-6 py-4">
                  <span className="font-bold">#{i+1} {p.name}</span>
                  <span className="text-yellow-400">{p.count} caught</span>
                </div>
              )) : <p className="text-center text-slate-400">No catches yet — be the first!</p>}
            </div>
            <button onClick={() => setShowLeaderboard(false)} className="mt-8 mx-auto block bg-red-500 text-white px-10 py-4 rounded-2xl">Close</button>
          </div>
        </div>
      )}

      {/* Your existing My Pokédex modal (unchanged) */}
    </div>
  );
}