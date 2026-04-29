self.addEventListener("message", (event: MessageEvent) => {
  const data = event.data as { type?: string };
  if (data.type === "airlink.init") {
    self.postMessage({ type: "airlink.ready" });
  }
});
