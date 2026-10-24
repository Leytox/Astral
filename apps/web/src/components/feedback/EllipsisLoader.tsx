import { Music, Music2, Music3, Music4 } from 'lucide-react';

export default function EllipsisLoader() {
  return (
    <div className="flex flex-row justify-center gap-5">
      <Music className="animate-bounce" />
      <Music2 className="animate-bounce [animation-delay:250ms]" />
      <Music4 className="animate-bounce [animation-delay:500ms]" />
      <Music3 className="animate-bounce [animation-delay:750ms]" />
    </div>
  );
}
