import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";

export function ServiceDetail() {
  return (
    <Card header={<h2 className="text-sm font-semibold">Service Detail</h2>}>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary">Start</Button>
        <Button variant="secondary">Restart</Button>
        <Button variant="danger">Stop</Button>
      </div>
    </Card>
  );
}
