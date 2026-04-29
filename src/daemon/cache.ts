type Node<K, V> = {
  key: K;
  value: V;
  expiresAt: number;
  prev: Node<K, V> | null;
  next: Node<K, V> | null;
};

export class LruCache<K, V> {
  private readonly items = new Map<K, Node<K, V>>();
  private head: Node<K, V> | null = null;
  private tail: Node<K, V> | null = null;

  constructor(
    private readonly capacity: number,
    private readonly ttlMs: number
  ) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error("LRU capacity must be positive");
    }
  }

  get(key: K): V | null {
    const node = this.items.get(key);
    if (!node) {
      return null;
    }
    if (node.expiresAt <= Date.now()) {
      this.delete(key);
      return null;
    }
    this.moveToHead(node);
    return node.value;
  }

  set(key: K, value: V): void {
    const existing = this.items.get(key);
    if (existing) {
      existing.value = value;
      existing.expiresAt = Date.now() + this.ttlMs;
      this.moveToHead(existing);
      return;
    }

    const node: Node<K, V> = {
      key,
      value,
      expiresAt: Date.now() + this.ttlMs,
      prev: null,
      next: null
    };
    this.items.set(key, node);
    this.addToHead(node);
    if (this.items.size > this.capacity && this.tail) {
      this.delete(this.tail.key);
    }
  }

  delete(key: K): void {
    const node = this.items.get(key);
    if (!node) {
      return;
    }
    this.detach(node);
    this.items.delete(key);
  }

  clearExpired(now = Date.now()): void {
    for (const [key, node] of this.items.entries()) {
      if (node.expiresAt <= now) {
        this.delete(key);
      }
    }
  }

  size(): number {
    return this.items.size;
  }

  private addToHead(node: Node<K, V>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) {
      this.head.prev = node;
    }
    this.head = node;
    if (!this.tail) {
      this.tail = node;
    }
  }

  private moveToHead(node: Node<K, V>): void {
    if (node === this.head) {
      return;
    }
    this.detach(node);
    this.addToHead(node);
  }

  private detach(node: Node<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    node.prev = null;
    node.next = null;
  }
}
