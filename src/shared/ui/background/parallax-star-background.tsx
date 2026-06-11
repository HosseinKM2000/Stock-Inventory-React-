"use client";

import { useCallback, useEffect, useState } from "react";
import "./parallax-star-background.css";

export default function ParallaxStarBackground() {
  const [stars, setStars] = useState({
    stars1: "",
    stars2: "",
    stars3: "",
  });

  const generateStars = useCallback((count: number, color: string) => {
    const stars = [];

    for (let i = 0; i < count; i++) {
      stars.push(
        `${Math.random() * 2000}px ${Math.random() * 2000}px ${color}`,
      );
    }

    return stars;
  }, []);

  useEffect(() => {
    const stars1 = generateStars(50, "#ffff").join(",");
    const stars2 = generateStars(100, "#ffff").join(",");
    const stars3 = generateStars(500, "#ffff").join(",");

    setStars({ stars1, stars2, stars3 });
  }, []);

  return (
    <>
      <div
        className="stars-1"
        style={{
          boxShadow: stars.stars1,
        }}
      />
      <div
        className="stars-2"
        style={{
          boxShadow: stars.stars2,
        }}
      />
      <div
        className="stars-3"
        style={{
          boxShadow: stars.stars3,
        }}
      />
    </>
  );
}
