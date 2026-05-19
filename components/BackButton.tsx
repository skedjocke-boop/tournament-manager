'use client'

import { useRouter } from 'next/navigation'

export default function BackButton() {
    const router = useRouter()

    return (
        <button 
            onClick={() => router.back()} 
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors mb-8"
        >
            <span className="text-lg leading-none">&larr;</span> Tillbaka
        </button>
    )
}