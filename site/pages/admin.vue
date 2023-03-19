<template>
  <v-app dark style="background: black">
    <v-main style="font-family: Rubik">
      <v-card color="black">
        <v-card-title>
          <span>Admin</span>
          <v-btn icon @click="refresh">
            <v-icon>mdi-refresh</v-icon>
          </v-btn>
        </v-card-title>
        <v-card-text>
          <v-simple-table>
            <template #default>
              <tbody>
                <tr v-for="game in games" :key="game.id">
                  <td>{{ game.id }}</td>
                  <td>{{ game.joined.length }}</td>
                  <td>{{ game.numberOfPlayers }}</td>
                  <td>{{ game.state }}</td>
                  <td style="text-align: right">
                    <v-btn icon @click="close(game.id)">
                      <v-icon>mdi-close</v-icon>
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </template>
          </v-simple-table>
        </v-card-text>
        <v-card-actions>
          <v-text-field v-model="n" placeholder="Number of players" />
          <v-spacer />
          <v-btn :disabled="!n" @click="start">
            start
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-main>
  </v-app>
</template>
<script>
// function delay (ms) {
//   return new Promise(resolve => setTimeout(resolve, ms))
// }
export default {
  data () {
    return {
      games: [],
      n: undefined
    }
  },
  async fetch () {
    await this.refresh()
  },
  methods: {
    async refresh () {
      this.games = await this.$axios.$get('/api/games')
    },
    async start () {
      await this.$axios.$post(`/api/start/${this.n}`)
      await this.refresh()
      this.n = undefined
    },
    async close (id) {
      this.games = await this.$axios.$post(`/api/close/${id}`)
    }
  }
}
</script>
