-- Create function to get birthdays for yesterday, today, and tomorrow
CREATE OR REPLACE FUNCTION public.get_nearby_birthdays()
RETURNS TABLE(
  user_id uuid, 
  full_name text, 
  nickname text, 
  birthday date,
  day_label text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id as user_id, 
    full_name, 
    nickname, 
    birthday,
    CASE 
      WHEN EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 day')
        AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '1 day')
      THEN 'yesterday'
      WHEN EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)
      THEN 'today'
      WHEN EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '1 day')
        AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '1 day')
      THEN 'tomorrow'
    END as day_label
  FROM public.profiles
  WHERE birthday IS NOT NULL
    AND (
      -- Yesterday
      (EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 day')
        AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '1 day'))
      OR
      -- Today
      (EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE))
      OR
      -- Tomorrow
      (EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE + INTERVAL '1 day')
        AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '1 day'))
    )
  ORDER BY 
    CASE 
      WHEN EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 day')
        AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '1 day')
      THEN 1
      WHEN EXTRACT(MONTH FROM birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM birthday) = EXTRACT(DAY FROM CURRENT_DATE)
      THEN 2
      ELSE 3
    END,
    full_name
$$;