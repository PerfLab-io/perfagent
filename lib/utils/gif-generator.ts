// This utility provides URLs for animations based on topic
export function getAnimationUrlForTopic(topic: string): string {
  // Map of topics to image URLs
  const topicImageMap: Record<string, string[]> = {
    "go-overview": [
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image.jpg-EljbehpZsrROFsykPrM7V98LGDL6Ij.jpeg",
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%282%29.jpg-XR4hQMGf76MbljfHkqY9rFzQ7qCGj1.jpeg",
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%281%29.jpg-Pz4QxdhLrFAVy9nqI9pErtlFMPMw73.jpeg",
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/homepage-bg.jpg-aFlNIlG7iU5DseeU9qnyR5yGpjvMIj.jpeg",
    ],
    concurrency: [
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%281%29.jpg-Pz4QxdhLrFAVy9nqI9pErtlFMPMw73.jpeg",
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/homepage-bg.jpg-aFlNIlG7iU5DseeU9qnyR5yGpjvMIj.jpeg",
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image.jpg-EljbehpZsrROFsykPrM7V98LGDL6Ij.jpeg",
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%282%29.jpg-XR4hQMGf76MbljfHkqY9rFzQ7qCGj1.jpeg",
    ],
    "error-handling": [
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/homepage-bg.jpg-aFlNIlG7iU5DseeU9qnyR5yGpjvMIj.jpeg",
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image.jpg-EljbehpZsrROFsykPrM7V98LGDL6Ij.jpeg",
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%282%29.jpg-XR4hQMGf76MbljfHkqY9rFzQ7qCGj1.jpeg",
      "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20%281%29.jpg-Pz4QxdhLrFAVy9nqI9pErtlFMPMw73.jpeg",
    ],
  }

  // Return the first image URL for the topic, or a default if not found
  const images = topicImageMap[topic] || topicImageMap["go-overview"]
  return images[0] // In a real implementation, this would be a GIF URL
}

