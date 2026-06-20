import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

export const IdePage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex items-center justify-between p-4">
        <h1 className="text-3xl font-bold">Curriculum Vitae IDE</h1>
        <ThemeSwitcher />
      </div>
      <div className="flex gap-2 p-4">
        <Button variant="default">Default</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </div>
  );
};
