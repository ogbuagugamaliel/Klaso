/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface StudentCodeBadgeProps {
  code: string;
  className?: string;
}

export default function StudentCodeBadge({ code, className = '' }: StudentCodeBadgeProps) {
  return (
    <span 
      id={`student-badge-${code}`}
      className={`inline-flex items-center justify-center font-mono font-bold tracking-wider rounded border text-[10px] px-1.5 py-0.5 text-teal-800 bg-teal-50 border-teal-200 ${className}`}
    >
      <span className="w-1 h-1 rounded-full bg-teal-500 mr-1 animate-pulse"></span>
      {code}
    </span>
  );
}
