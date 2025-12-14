
    import { createClient } from '@supabase/supabase-js';

    const supabaseUrl = 'https://wruysjrqadlsljnkmnte.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndydXlzanJxYWRsc2xqbmttbnRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc4NzA1NzksImV4cCI6MjA2MzQ0NjU3OX0.E4oUnKQ87s5ZBQfE2cWt7R6SkNbMnRQW2wvj2oD91KM';

    export const supabase = createClient(supabaseUrl, supabaseAnonKey);
  