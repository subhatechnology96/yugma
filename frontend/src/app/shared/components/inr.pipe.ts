import { Pipe, PipeTransform } from '@angular/core';
import { formatNumber } from '@angular/common';

// ₹ formatting in Indian style.
//  - 'full'    → grouped lakh/crore digits, e.g. ₹92,86,400
//  - 'compact' → abbreviated, e.g. ₹92.86 L, ₹1.25 Cr
@Pipe({ name: 'inr', standalone: true })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined, mode: 'full' | 'compact' = 'full'): string {
    if (value === null || value === undefined || isNaN(value)) return '—';
    if (mode === 'compact') return '₹' + this.compact(value);
    return '₹' + formatNumber(value, 'en-IN', '1.0-0');
  }

  private compact(v: number): string {
    const abs = Math.abs(v);
    if (abs >= 1e7) return this.trim(v / 1e7) + ' Cr';
    if (abs >= 1e5) return this.trim(v / 1e5) + ' L';
    return formatNumber(v, 'en-IN', '1.0-0');
  }

  private trim(n: number): string {
    return n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }
}
