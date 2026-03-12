'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Download, Loader2 } from 'lucide-react';
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
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchWeather = async (lat: number, lon: number, cityName: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
      );
      const data = await res.json();
      
      const condition = weatherCodeMap[data.current.weather_code] || 'cloudy';
      const mainType = typeToPokemonTypes[condition][0];

      setWeather({
        temperature: Math.round(data.current.temperature_2m),
        weatherCode: data.current.weather_code,
        city: cityName
      });

      const types = typeToPokemonTypes[condition];
      const allPokemon: Pokemon[] = [];
      
      for (const t of types) {
        const typeRes = await fetch(`https://pokeapi.co/api/v2/type/${t}`);
        const typeData = await typeRes.json();
        const randoms = typeData.pokemon
          .sort(() => 0.5 - Math.random())
          .slice(0, 2);

        for (const p of randoms) {
          const pokeRes = await fetch(p.pokemon.url);
          const pokeData = await pokeRes.json();
          allPokemon.push({
            name: pokeData.name,
            sprite: pokeData.sprites.front_default,
            type: t
          });
        }
      }
      
      setPokemons(allPokemon.slice(0, 4));
    } catch (err) {
      setError('Could not fetch weather. Try another city!');
    }
    setLoading(false);
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&count=1&language=en&format=json`
        );
        const data = await res.json();
        const cityName = data.results?.[0]?.name || 'Your Location';
        await fetchWeather(pos.coords.latitude, pos.coords.longitude, cityName);
      },
      () => setError('Location access denied')
    );
  };

  const searchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
      );
      const data = await res.json();
      
      if (!data.results?.length) {
        setError('City not found!');
        setLoading(false);
        return;
      }
      
      const { latitude, longitude, name } = data.results[0];
      await fetchWeather(latitude, longitude, name);
    } catch {
      setError('Error searching city');
    }
    setLoading(false);
  };

  const downloadCard = async () => {
    const element = document.getElementById('catch-card');
    if (!element || !weather) return;
    
    const canvas = await html2canvas(element, {
      scale: 3,           // super sharp
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#1f2937',  // solid dark background (fixes blank white)
      logging: false
    });
    
    const link = document.createElement('a');
    link.download = `pokecast-${weather.city}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Header */}
      <div className="text-center pt-12 pb-8">
        <h1 className="poke-title text-7xl font-bold text-yellow-400 tracking-widest">POKÉCAST</h1>
        <p className="text-xl mt-2 text-slate-400">Weather where Pokémon roam free</p>
      </div>

      {/* Search */}
      <div className="max-w-2xl mx-auto px-6">
        <form onSubmit={searchCity} className="flex gap-3 mb-8">
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Enter city name..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-lg focus:outline-none focus:border-yellow-400"
          />
          <button type="submit" disabled={loading} className="bg-yellow-400 hover:bg-yellow-300 text-black font-bold px-8 rounded-2xl flex items-center gap-2">
            <Search size={20} /> Search
          </button>
        </form>

        <button
          onClick={getUserLocation}
          className="w-full bg-white/10 hover:bg-white/20 border border-white/30 py-4 rounded-2xl flex items-center justify-center gap-3 text-lg font-medium"
        >
          <MapPin /> Use My Location (Franklin, OH style!)
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center mt-12">
          <Loader2 className="animate-spin mx-auto text-6xl text-yellow-400" />
          <p className="mt-4 text-slate-400">Calling wild Pokémon...</p>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-red-400 text-center mt-6">{error}</p>}

      {/* Main App */}
      {weather && !loading && (
        <div className="max-w-5xl mx-auto px-6 py-12">
          <div className={`weather-bg bg-gradient-to-br ${typeColors[weatherCodeMap[weather.weatherCode] || 'cloudy']} rounded-3xl p-12 text-center shadow-2xl`}>
            
            {/* FULL CATCH CARD (now includes city + temp + Pokémon) */}
            <div id="catch-card" className="bg-slate-900 rounded-3xl p-10 border border-yellow-400/50">
              <h2 className="text-5xl font-bold text-white">{weather.city}</h2>
              <div className="text-8xl my-6 font-bold text-yellow-400">
                {weather.temperature}°C / {Math.round(weather.temperature * 9/5 + 32)}°F
              </div>
              
              <h3 className="text-3xl mb-8 text-white">Wild Pokémon sighted today!</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {pokemons.map((p, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                    <PokemonCard name={p.name} sprite={p.sprite} type={p.type} />
                  </motion.div>
                ))}
              </div>
            </div>

            <button
              onClick={downloadCard}
              className="mt-10 bg-white text-black font-bold px-10 py-4 rounded-2xl flex items-center gap-3 mx-auto hover:scale-105 transition"
            >
              <Download /> Download Catch Card
            </button>
          </div>
        </div>
      )}

      <div className="text-center text-slate-500 mt-20 pb-12">
        Made with ❤️ for the Pokémon community • Powered by Open-Meteo + PokeAPI
      </div>
    </div>
  );
}