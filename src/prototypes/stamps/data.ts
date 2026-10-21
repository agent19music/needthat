export const categories = ['All', 'Tech', 'Clothes', 'Subscriptions'] as const

export type Category = (typeof categories)[number]

export type Wish = {
  id: string
  title: string
  category: Exclude<Category, 'All'>
  source: string
  price: string
  image: string
}

export const wishes: Array<Wish> = [
  {
    id: 'macbook',
    title: 'MacBook Pro 14-inch 2023 M3',
    category: 'Tech',
    source: 'Apple',
    price: 'KSh 249,000',
    image:
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'iphone',
    title: 'iPhone 17',
    category: 'Tech',
    source: 'Apple',
    price: 'KSh 148,000',
    image:
      'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'watch',
    title: 'Apple Watch Series 10 aluminum case with sport band',
    category: 'Tech',
    source: 'Apple',
    price: 'KSh 54,000',
    image:
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'shoes',
    title: 'adidas Women Trainers Handball Spezial SHOES',
    category: 'Clothes',
    source: 'adidas',
    price: 'KSh 14,500',
    image:
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'jersey',
    title:
      "Nike Shirts Barcelona Xavi 2001/02 Soccer Men's Jersey Size Medium Dry-Fit Color Blue Gold",
    category: 'Clothes',
    source: 'Karina0407',
    price: 'KSh 18,200',
    image:
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'jacket',
    title: 'Uniqlo blocktech parka for the rainy Nairobi commute',
    category: 'Clothes',
    source: 'Uniqlo',
    price: 'KSh 8,900',
    image:
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'headphones',
    title: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones Black',
    category: 'Tech',
    source: 'Sony',
    price: 'KSh 32,000',
    image:
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'notion',
    title: 'Notion Plus yearly subscription for the household',
    category: 'Subscriptions',
    source: 'Notion',
    price: 'KSh 9,600 / year',
    image:
      'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'spotify',
    title: 'Spotify family plan shared across two apartments',
    category: 'Subscriptions',
    source: 'Spotify',
    price: 'KSh 1,200 / month',
    image:
      'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&w=800&q=80',
  },
]

const swatches: Record<Category, string> = {
  All: 'var(--sea-ink)',
  Tech: 'var(--lagoon-deep)',
  Clothes: 'var(--palm)',
  Subscriptions: 'var(--lagoon)',
}

export function wishesIn(category: Category) {
  if (category === 'All') return wishes
  return wishes.filter((wish) => wish.category === category)
}

export function clipWords(title: string, count = 6) {
  const words = title.trim().split(/\s+/)
  if (words.length <= count) return title
  return `${words.slice(0, count).join(' ')}…`
}

export function swatchFor(category: Category) {
  return swatches[category]
}
