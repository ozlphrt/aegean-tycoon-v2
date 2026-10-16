import { describe, it, expect } from 'vitest';
import { calculatePrice, updateStock } from './economy';

describe('Economy Simulation', () => {
  it('calculates price higher when stock is scarce', () => {
    const basePrice = 20;
    const targetStock = 50;

    const scarcePrice = calculatePrice({ basePrice, stock: 2, targetStock });
    const abundantPrice = calculatePrice({ basePrice, stock: 150, targetStock });

    expect(scarcePrice).toBeGreaterThan(basePrice);
    expect(abundantPrice).toBeLessThan(basePrice);
  });

  it('clamps price multiplier between 0.3x and 3.0x', () => {
    const basePrice = 100;
    const zeroStockPrice = calculatePrice({ basePrice, stock: 0, targetStock: 500 });
    const mountainStockPrice = calculatePrice({ basePrice, stock: 10000, targetStock: 10 });

    expect(zeroStockPrice).toBeLessThanOrEqual(300);
    expect(mountainStockPrice).toBeGreaterThanOrEqual(30);
  });

  it('updates stock properly over time and detects starving condition', () => {
    // Producer has net positive stock
    const producer = updateStock(10, 5, 2, 2, 100);
    expect(producer.stock).toBe(16);
    expect(producer.isStarving).toBe(false);

    // Consumer drains to zero
    const starvingConsumer = updateStock(2, 0, 5, 1, 100);
    expect(starvingConsumer.stock).toBe(0);
    expect(starvingConsumer.isStarving).toBe(true);
  });
});
