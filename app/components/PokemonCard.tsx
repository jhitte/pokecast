import React from 'react';

interface Props {
  name: string;
  sprite: string;
  type: string;
}

export default function PokemonCard({ name, sprite, type }: Props) {
  return (
    <div className="pokemon-card bg-white/10 backdrop-blur-md rounded-2xl p-6 text-center border border-white/20">
      <img src={sprite} alt={name} className="mx-auto w-28 h-28 drop-shadow-xl" />
      <h3 className="capitalize font-bold text-xl mt-3">{name}</h3>
      <div className="text-xs uppercase tracking-widest text-yellow-300 mt-1">Type: {type}</div>
    </div>
  );
}