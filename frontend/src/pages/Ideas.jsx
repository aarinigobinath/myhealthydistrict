import { api } from '../api'
import { Heading, Loading, SearchBar, useLoad } from '../components/ui.jsx'
import { IdeaCard, useVote } from './Voice.jsx'

export default function Ideas() {
  const [st, set] = useLoad(() => api('/voice'), [])
  const vote = useVote(set)
  return (
    <>
      <SearchBar placeholder="Search ideas" />
      <Heading title="Help shape Forsyth" sub="Back the ideas you want to see. Support here is a community pulse, not official public comment." />
      <Loading state={st} />
      <div className="grid g3">{st.data?.ideas.map((i) => <IdeaCard key={i.id} i={i} onVote={vote} />)}</div>
    </>
  )
}
