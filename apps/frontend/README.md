# Research Assistant - Frontend

Modern React frontend with Vite, Tailwind CSS, and state management.

## Tech Stack

- **React 18**: UI library
- **Vite**: Build tool & dev server
- **Tailwind CSS**: Utility-first styling
- **Zustand**: State management
- **Axios**: HTTP client
- **React Router**: Navigation
- **Lucide React**: Icons

## Project Structure

```
frontend/
├── src/
│   ├── api/              # API client
│   ├── components/       # React components
│   ├── hooks/            # Custom hooks
│   ├── pages/            # Page components
│   ├── store/            # Zustand stores
│   ├── styles/           # Global styles
│   ├── utils/            # Utilities
│   ├── App.jsx           # Main app
│   └── main.jsx          # Entry point
├── public/               # Static assets
├── index.html            # HTML template
├── vite.config.js        # Vite config
├── tailwind.config.js    # Tailwind config
└── package.json          # Dependencies
```

## Installation

```bash
# Install dependencies
npm install

# or with yarn
yarn install

# or with pnpm
pnpm install
```

## Development

```bash
# Start dev server
npm run dev

# Access at http://localhost:5173
```

## Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Features

### Pages
- **Landing**: Welcome + features
- **Login/Register**: Authentication
- **Dashboard**: Main research interface
- **Saved Queries**: Browse saved research
- **Settings**: User preferences

### Components
- **SearchBar**: Paper search
- **PaperCard**: Display paper info
- **SynthesisView**: AI-generated answer
- **SavedQueryList**: Grid of saved queries
- **Header**: Navigation + user menu
- **Modal**: Reusable dialog

### State Management

Using Zustand for global state:

```javascript
// stores/authStore.js
export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  login: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
}))
```

### API Integration

Axios instance with interceptors:

```javascript
// api/client.js
const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

## Environment Variables

Create `.env.local`:

```ini
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=Research Assistant
```

## Styling

Tailwind CSS with custom theme:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        secondary: '#10b981',
      },
    },
  },
}
```

## Deployment

### Vercel
```bash
vercel --prod
```

### Netlify
```bash
netlify deploy --prod
```


## Performance

- Code splitting
- Lazy loading
- Image optimization
- CSS purging
- Gzip compression

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## License

MIT
