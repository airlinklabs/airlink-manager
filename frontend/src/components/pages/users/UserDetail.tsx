import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";

export function UserDetail() {
  return (
    <Card header={<h2 className="text-sm font-semibold">User Actions</h2>}>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary">Lock</Button>
        <Button variant="secondary">Modify</Button>
        <Button variant="danger">Delete</Button>
      </div>
    </Card>
  );
}
