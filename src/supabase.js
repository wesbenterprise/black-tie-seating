import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Falling back to localStorage.')
}

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Storage adapter that matches the window.storage API
// Uses Supabase when available, falls back to localStorage
export const storage = {
  async get(key) {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('seating_events')
          .select('*')
          .eq('key', key)
          .single()
        
        if (error || !data) return null
        
        return {
          key: data.key,
          value: JSON.stringify({
            eventName: data.event_name,
            versionName: data.version_name,
            tables: data.tables,
            unseated: data.unseated,
            savedAt: data.saved_at
          })
        }
      } catch (e) {
        console.error('Supabase get error:', e)
        return null
      }
    } else {
      // localStorage fallback
      try {
        const value = localStorage.getItem(key)
        return value ? { key, value } : null
      } catch (e) {
        return null
      }
    }
  },

  async set(key, value) {
    if (supabase) {
      try {
        const parsed = JSON.parse(value)
        const { data, error } = await supabase
          .from('seating_events')
          .upsert({
            key,
            event_name: parsed.eventName,
            version_name: parsed.versionName,
            tables: parsed.tables,
            unseated: parsed.unseated,
            saved_at: parsed.savedAt,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' })
          .select()
        
        if (error) {
          console.error('Supabase set error:', error)
          return null
        }
        return { key, value }
      } catch (e) {
        console.error('Supabase set error:', e)
        return null
      }
    } else {
      // localStorage fallback
      try {
        localStorage.setItem(key, value)
        return { key, value }
      } catch (e) {
        return null
      }
    }
  },

  async delete(key) {
    if (supabase) {
      try {
        const { error } = await supabase
          .from('seating_events')
          .delete()
          .eq('key', key)
        
        if (error) {
          console.error('Supabase delete error:', error)
          return null
        }
        return { key, deleted: true }
      } catch (e) {
        console.error('Supabase delete error:', e)
        return null
      }
    } else {
      // localStorage fallback
      try {
        localStorage.removeItem(key)
        return { key, deleted: true }
      } catch (e) {
        return null
      }
    }
  },

  async list(prefix = '') {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('seating_events')
          .select('key')
          .like('key', `${prefix}%`)
        
        if (error) {
          console.error('Supabase list error:', error)
          return { keys: [] }
        }
        return { keys: data.map(row => row.key) }
      } catch (e) {
        console.error('Supabase list error:', e)
        return { keys: [] }
      }
    } else {
      // localStorage fallback
      try {
        const keys = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith(prefix)) {
            keys.push(key)
          }
        }
        return { keys }
      } catch (e) {
        return { keys: [] }
      }
    }
  }
}
