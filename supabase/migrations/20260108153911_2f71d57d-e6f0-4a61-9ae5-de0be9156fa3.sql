-- Add CRUD policies for werknemers (currently only has ALL and SELECT)
-- Drop existing overlapping policy and add specific ones

-- For rolprofielen - add INSERT, UPDATE, DELETE policies
CREATE POLICY "Planners insert rollen" 
ON public.rolprofielen 
FOR INSERT 
WITH CHECK (EXISTS ( SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

CREATE POLICY "Planners update rollen" 
ON public.rolprofielen 
FOR UPDATE 
USING (EXISTS ( SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

CREATE POLICY "Planners delete rollen" 
ON public.rolprofielen 
FOR DELETE 
USING (EXISTS ( SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

-- For disciplines - add INSERT, UPDATE, DELETE policies
CREATE POLICY "Planners insert disciplines" 
ON public.disciplines 
FOR INSERT 
WITH CHECK (EXISTS ( SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

CREATE POLICY "Planners update disciplines" 
ON public.disciplines 
FOR UPDATE 
USING (EXISTS ( SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));

CREATE POLICY "Planners delete disciplines" 
ON public.disciplines 
FOR DELETE 
USING (EXISTS ( SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_planner = true));