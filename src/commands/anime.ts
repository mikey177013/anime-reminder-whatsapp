import { Anime } from '@shineiichijo/marika'
import { BaseCommand, MAL_LOGO_URL } from '../lib'
import { Message, IParam } from '../types'

export default class extends BaseCommand {
	constructor() {
		super({
			name: 'anime',
			description:
				'Gets the info of an anime from its id (MAL)/Searches for anime from MyAnimeList',
			cooldown: 15,
			usage:
				'anime (--method=search) <query> (--page=1) || anime --method=get <mal_id>',
		})
	}

	public override execute = async (
		M: Message,
		{ flags, context }: IParam,
	): Promise<void> => {
		let method: 'search' | 'get' = flags.method === 'get' ? 'get' : 'search'

		if (!context)
			return void (await M.reply(
				`Provide the ${
					method === 'search'
						? `query to search. Example - *${this.client.config.prefix}anime --method=${method} fairy tail*`
						: `id (MAL) to get the info. Example - *${this.client.config.prefix}anime --method=${method} 6702*`
				}`,
			))

		const anime = new Anime()
		const query =
			method === 'get' ? context.trim().split(' ')[0] : context.trim()

		if (method === 'search') {
			const page =
				flags.page && !isNaN(Number(flags.page))
					? parseInt(flags.page)
					: 1
			return await this.handleSearch(M, anime, query, page)
		}

		return await this.handleGet(M, anime, query)
	}

	private handleSearch = async (
		M: Message,
		anime: Anime,
		q: string,
		page: number,
	): Promise<void> => {
		if (page < 1) page = 1

		const res = await anime
			.getAnimeSearch({ q, page, limit: 10 })
			.catch(() => undefined)

		if (!res)
			return void (await M.reply(
				`Couldn't find any anime of the query, *"${q}"*`,
			))

		const { pagination, data } = res
		if (!data?.length)
			return void (await M.reply(
				page > 1
					? 'Invalid page.'
					: `Couldn't find any anime of the query, *"${q}"*`,
			))

		let text = ''
		if (pagination?.last_visible_page > 1)
			text += `📗 *Current Page:* ${page}\n📘 *Total Pages:* ${pagination.last_visible_page}\n`

		for (let i = 0; i < data.length; i++) {
			const item = data[i]
			text += `\n*#${i + 1}*\n${
				item.title_english || item.title_japanese
			}\n*[Use ${
				this.client.config.prefix
			}anime --method=get ${item.mal_id} to get the full info of the anime]*\n`
		}

		const first = data[0]
		const image = await this.client.utils.getBuffer(
			first.images?.jpg?.large_image_url ||
				first.images?.jpg?.image_url ||
				first.images?.jpg?.small_image_url ||
				MAL_LOGO_URL,
		)

		await this.client.sock.sendMessage(
			M.from,
			{
				image,
				caption: text.trim(),
				jpegThumbnail:
					process.platform === 'win32'
						? image.toString('base64')
						: undefined,
				contextInfo: {
					externalAdReply: {
						body: first.title_english || first.title,
						title: 'MyAnimeList',
						sourceUrl: first.url,
						thumbnail: await this.client.utils.getBuffer(MAL_LOGO_URL),
					},
				},
			},
			{ quoted: M.message },
		)
	}

	private handleGet = async (
		M: Message,
		anime: Anime,
		id: string,
	): Promise<void> => {
		const res = await anime.getAnimeById(id).catch(() => undefined)
		if (!res) return void (await M.reply('Invalid anime id (MAL).'))

		const ids = (
			await this.client.db.getAnimeList(M.sender.id)
		).map((x) => x.mal_id)

		let text = `🎈 *Title:* ${
			res.title_english || res.title
		}\n❓ *Registered:* ${this.client.utils.capitalise(
			`${ids.includes(res.mal_id.toString())}`,
		)} ${
			res.airing && !ids.includes(res.mal_id.toString())
				? '(Can be registered)'
				: !res.airing
				? "(Can't be registered)"
				: ''
		}\n♦ *Year:* ${res.year || 'Unknown'}`

		if (res.scored_by && res.score)
			text += `\n🎗 *Score:* ${res.score} (from ${res.scored_by} MAL users)`

		if (res.genres?.length)
			text += `\n🏮 *Genres:* ${res.genres
				.map((genre) => genre.name)
				.join(', ')}`

		if (res.synopsis) text += `\n\n🧧 *Synopsis:* ${res.synopsis}`

		if (res.airing && !ids.includes(res.mal_id.toString()))
			text += `\n\n*[Use ${
				this.client.config.prefix
			}register --id=${res.mal_id} to be notified when a new episode of this anime airs]*`

		const image = await this.client.utils.getBuffer(
			res.images?.jpg?.large_image_url ||
				res.images?.jpg?.image_url ||
				res.images?.jpg?.small_image_url ||
				MAL_LOGO_URL,
		)

		await this.client.sock.sendMessage(
			M.from,
			{
				image,
				caption: text.trim(),
				jpegThumbnail:
					process.platform === 'win32'
						? image.toString('base64')
						: undefined,
				contextInfo: {
					externalAdReply: {
						body: res.title_english || res.title,
						title: 'MyAnimeList',
						sourceUrl: res.url,
						thumbnail: await this.client.utils.getBuffer(MAL_LOGO_URL),
					},
				},
			},
			{ quoted: M.message },
		)
	}
}