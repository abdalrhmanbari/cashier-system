import { redirect } from 'next/navigation'

interface Props {
  params: { slug: string }
}

export default function StoreRootPage({ params }: Props) {
  redirect(`/${params.slug}/pos`)
}
