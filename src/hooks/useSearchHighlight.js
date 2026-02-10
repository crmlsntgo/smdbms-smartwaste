import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Hook to manage search highlighting state and logic.
 * Reads from navigation state and provides helpers to apply classes.
 */
export const useSearchHighlight = () => {
    const location = useLocation()
    const [highlightedId, setHighlightedId] = useState(null)
    const [highlightedTerm, setHighlightedTerm] = useState(null)

    useEffect(() => {
        if (location.state) {
            // Identifier based highlight (e.g. specific bin, setting section)
            if (location.state.highlightId) {
                setHighlightedId(location.state.highlightId)
                
                // Scroll into view if element exists
                // We do this in a slight timeout to ensure render
                setTimeout(() => {
                    const el = document.getElementById(location.state.highlightId)
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                }, 500)

                // Auto-clear visual highlight after animation time
                const timer = setTimeout(() => {
                    setHighlightedId(null)
                }, 3500) // 3s animation + buffer
                return () => clearTimeout(timer)
            }
            
            // Term based highlight (for text search matches)
            if (location.state.highlightTerm) {
                setHighlightedTerm(location.state.highlightTerm)
                 const timer = setTimeout(() => {
                    setHighlightedTerm(null)
                }, 3500)
                return () => clearTimeout(timer)
            }
        }
    }, [location])

    /**
     * returns "search-highlight-target" if the id matches the active highlight
     */
    const getHighlightClass = (id) => {
        if (highlightedId && id === highlightedId) {
             return 'search-highlight-target'
        }
        return ''
    }

    /**
     * Checks if text contains the highlighted term
     */
    const isHighlightedText = (text) => {
        if (!highlightedTerm || !text) return false
        return text.toLowerCase().includes(highlightedTerm.toLowerCase())
    }

    return {
        highlightedId,
        highlightedTerm,
        getHighlightClass,
        isHighlightedText
    }
}
