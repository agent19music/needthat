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
]

export function wishesIn(category: Category) {
  if (category === 'All') return wishes
  return wishes.filter((wish) => wish.category === category)
}
