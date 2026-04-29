import { motion } from "framer-motion";
import { Container, Download } from "lucide-react";
import { useContainers, useImages, useVolumes } from "../../../api/docker.ts";
import { pageTransition, pageVariants } from "../../../lib/motion.ts";
import { Button } from "../../ui/Button.tsx";
import { Card } from "../../ui/Card.tsx";
import { EmptyState } from "../../ui/EmptyState.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/Tabs.tsx";
import { PageHeader } from "../../shell/PageHeader.tsx";
import { ContainerList } from "./ContainerList.tsx";
import { ImageList } from "./ImageList.tsx";

export function DockerPage() {
  const containers = useContainers();
  const images = useImages();
  useVolumes();
  if (containers.isError) {
    return <EmptyState icon={Container} title="Docker not available" message="Docker socket was not detected or is not accessible." />;
  }
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
      <PageHeader title="Docker" description="Containers, images, volumes, and networks." action={<Button><Download className="h-4 w-4" />Pull Image</Button>} />
      <Tabs defaultValue="containers">
        <TabsList>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="volumes">Volumes</TabsTrigger>
          <TabsTrigger value="networks">Networks</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>
        <TabsContent value="containers" className="mt-4">
          <Card><ContainerList rows={[]} /></Card>
        </TabsContent>
        <TabsContent value="images" className="mt-4">
          <Card><ImageList rows={[]} /></Card>
        </TabsContent>
        <TabsContent value="volumes" className="mt-4">
          <Card><p className="text-sm text-[var(--theme-text-body)]">No volumes reported.</p></Card>
        </TabsContent>
        <TabsContent value="networks" className="mt-4">
          <Card><p className="text-sm text-[var(--theme-text-body)]">No networks reported.</p></Card>
        </TabsContent>
        <TabsContent value="info" className="mt-4">
          <Card><pre className="text-xs">{JSON.stringify({ containers: containers.data, images: images.data }, null, 2)}</pre></Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
