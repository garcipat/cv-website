import { Button } from '@/components/ui/button';

export const App = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <h1 className="text-3xl font-bold">CV</h1>
      <div className="flex gap-2 p-4">
        <Button variant="default">Default</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="outline">Outline</Button>
      </div>
    </div>
  );
};
