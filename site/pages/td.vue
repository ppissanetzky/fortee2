<template>
  <div>
    <!-- DIALOG FOR USERS -->
    <v-dialog
      v-model="userDialog"
      max-width="375"
    >
      <v-card v-if="user">
        <v-toolbar flat color="secondary" class="white--text mb-3">
          <v-toolbar-title>
            <div class="d-flex flex-column">
              {{ user.name }}
              <span class="caption">This "name" is from {{ user.source }}</span>
            </div>
          </v-toolbar-title>
          <v-spacer />
          <v-btn small outlined color="white" @click="userDialog=false">
            cancel
          </v-btn>
        </v-toolbar>
        <v-card-actions>
          <v-select
            v-model="user.type"
            dense
            hide-details
            outlined
            label="Type"
            :items="['blocked', 'guest', 'standard']"
          />
        </v-card-actions>
        <v-card-actions>
          <v-text-field
            v-model="user.displayName"
            dense
            outlined
            label="Display name"
            hint="This will be seen by everyone"
            persistent-hint
          />
        </v-card-actions>
        <v-card-actions>
          <v-text-field
            v-model="user.ourName"
            dense
            outlined
            label="Real name"
            hint="For us to track the real name if we know it. Will not be seen by anyone else"
            persistent-hint
          />
        </v-card-actions>
        <v-card-actions>
          <v-textarea
            v-model="user.notes"
            dense
            outlined
            label="Notes"
            hint="For us to track anything. Will not be seen by anyone else"
            persistent-hint
          />
        </v-card-actions>
        <v-card-title v-if="you.roles?.includes('admin')">
          Admin
        </v-card-title>
        <v-card-actions v-if="you.roles?.includes('admin')">
          <v-select
            v-model="user.roles"
            :items="['td', 'admin']"
            label="Roles"
            multiple
            outlined
            dense
            hide-details
          />
        </v-card-actions>
        <v-card-actions>
          <v-spacer />
          <strong class="red--text pr-2">{{ error }}</strong>
          <v-btn
            outlined
            color="primary"
            :loading="saving"
            :disabled="!!error"
            @click="saveUser"
          >
            save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- DIALOG FOR TOURNAMENTS -->
    <v-dialog
      v-model="dialog"
      max-width="800"
    >
      <v-card v-if="editing">
        <v-toolbar flat color="secondary" class="white--text mb-3">
          <v-toolbar-title>
            {{ editing.id ? `Tournament ${editing.id}` : 'New tournament' }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn small outlined color="white" class="mr-1" @click="duplicate">
            duplicate
          </v-btn>
          <v-btn small outlined color="white" @click="dialog=false">
            cancel
          </v-btn>
        </v-toolbar>
        <v-card-actions>
          <v-text-field
            v-model="editing.name"
            dense
            label="Name"
            outlined
            hide-details
          />
        </v-card-actions>
        <v-card-actions>
          <v-select
            v-model="editing.every"
            dense
            hide-details
            outlined
            label="Runs every"
            class="mr-2"
            :items="every"
            clearable
            :disabled="!editing.every"
          />
          <v-text-field
            v-model="editing.openTime"
            dense
            label="Opens at"
            outlined
            hide-details
            class="mr-2"
          />
          <v-text-field
            v-model="editing.closeTime"
            dense
            label="Closes at"
            outlined
            hide-details
            class="mr-2"
          />
          <v-text-field
            v-model="editing.startTime"
            dense
            label="Starts at"
            outlined
            hide-details
          />
        </v-card-actions>
        <v-card-actions>
          <v-select
            v-model="editing.partner"
            dense
            hide-details
            outlined
            label="Partner"
            class="mr-2"
            :items="partners"
          />
          <v-text-field
            v-model="editing.host"
            dense
            label="Host"
            outlined
            hide-details
          />
        </v-card-actions>
        <!-- RULES -->
        <Rules v-model="editing.rules" class="pa-2" />
        <v-card-actions>
          <v-btn
            v-if="editing.id"
            outlined
            color="error"
            class="mr-3"
            :disabled="!sure"
            @click="remove"
          >
            delete
          </v-btn>
          <v-checkbox
            v-if="editing.id"
            v-model="sure"
            label="Are you sure?"
          />
          <v-spacer />
          <strong class="red--text pr-2">{{ error }}</strong>
          <v-btn
            outlined
            color="primary"
            :loading="saving"
            :disabled="!!error"
            @click="save"
          >
            save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- MAIN  -->
    <v-card flat tile class="mb-3">
      <v-tabs v-model="tab" background-color="#c0d4e5" grow>
        <v-tab>Users</v-tab>
        <v-tab>Today's Ts</v-tab>
        <v-tab>Recurring Ts</v-tab>
        <v-tab>Server status</v-tab>
        <v-tab>Stats</v-tab>
      </v-tabs>
    </v-card>

    <v-tabs-items v-model="tab">
      <!-- USERS -->
      <v-tab-item>
        <v-toolbar flat>
          <v-select
            v-model="userType"
            :items="['all', 'blocked', 'guest', 'standard']"
            hide-details
            dense
            outlined
            label="Type"
          />
          <v-text-field
            v-model="userSearch"
            append-icon="mdi-magnify"
            label="Search"
            single-line
            hide-details
            dense
            outlined
            clearable
            class="px-4"
          />
        </v-toolbar>
        <v-data-table
          :headers="userHeaders"
          :items="users"
          :search="userSearch"
          item-key="id"
          @click:row="editUser"
        />
      </v-tab-item>
      <!-- TODAY'S TOURNEYS -->
      <v-tab-item>
        <v-data-table
          :headers="headers.filter(({value}) => value !== 'every')"
          :items="todays"
          :search="search"
          item-key="id"
          @click:row="edit"
        />
      </v-tab-item>
      <!-- RECURRING TOURNEYS -->
      <v-tab-item>
        <v-toolbar flat>
          <v-select
            v-model="everyFilter"
            :items="every"
            multiple
            hide-details
            dense
            outlined
            clearable
            label="Days"
          />
          <v-text-field
            v-model="search"
            append-icon="mdi-magnify"
            label="Search"
            single-line
            hide-details
            dense
            outlined
            clearable
            class="px-4"
          />
        </v-toolbar>
        <v-data-table
          :headers="headers"
          :items="recurring"
          :search="search"
          item-key="id"
          @click:row="edit"
        />
      </v-tab-item>
      <!-- SERVER STATUS -->
      <v-tab-item>
        <v-btn text @click="loadStatus">
          refresh
        </v-btn>
        <div v-for="s in status" :key="s.name">
          <h3 class="ml-3 mt-3">
            {{ s.name }}
          </h3>
          <v-simple-table dense>
            <template #default>
              <thead>
                <tr>
                  <th v-for="c in s.table.columns" :key="c">
                    {{ c }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in s.table.rows" :key="i">
                  <td v-for="(n, j) in r" :key="j">
                    {{ n }}
                  </td>
                </tr>
              </tbody>
            </template>
          </v-simple-table>
        </div>
      </v-tab-item>
      <!-- STATS -->
      <v-tab-item>
        <v-toolbar flat>
          <v-select
            v-model="statType"
            :items="statList"
            hide-details
            dense
            outlined
            label="Type"
          />
          <v-text-field
            v-model="statSearch"
            append-icon="mdi-magnify"
            label="Search"
            single-line
            hide-details
            dense
            outlined
            clearable
            class="px-4"
          />
          <v-select
            v-model="statSince"
            :items="['1 day', '1 week', '1 month', '1 year']"
            hide-details
            dense
            outlined
            clearable
            label="Duration"
          />
        </v-toolbar>
        <div class="d-flex flex-row">
          <v-sheet max-width="375" class="ml-3">
            <v-data-table
              :items="stats"
              :headers="statsHeaders"
              :search="statSearch"
              :custom-sort="statSort"
              @click:row="(row) => { statSearch = row.name }"
            />
          </v-sheet>
          <v-sheet max-width="375" class="ml-16">
            <v-data-table
              :items="statsMinMax"
              :headers="statsHeaders"
              hide-default-footer
              :disable-sort="true"
              @click:row="(row) => { statSearch = row.name }"
            />
          </v-sheet>
        </div>
      </v-tab-item>
    </v-tabs-items>
  </div>
</template>
<script>
export default {
  data () {
    return {
      you: {},
      ts: [],
      todays: [],
      users: [],
      status: [],
      statList: [],
      stats: [],
      statsMinMax: [],
      statsFormat: undefined,
      headers: [
        { text: 'Name', value: 'name' },
        { text: 'Every', value: 'every', groupable: true },
        { text: 'Opens', value: 'openTime', align: 'end' },
        { text: 'Closes', value: 'closeTime', align: 'end' },
        { text: 'Starts', value: 'startTime', align: 'end' },
        { text: 'Rules', value: 'rulesDesc' }
      ],
      every: [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
        'Saturday', 'Sunday', 'Every day', 'Weekdays'
      ],
      partners: [
        { value: 1, text: 'Random' },
        { value: 2, text: 'Choose' }
      ],
      userHeaders: [
        { text: 'External name', value: 'name' },
        { text: 'Display name', value: 'displayName' },
        { text: 'Real name', value: 'ourName' },
        { text: 'E-mail', value: 'email' },
        { text: 'Type', value: 'type' },
        { text: 'Last login', value: 'loginAge' },
        { text: 'Roles', value: 'roleList' },
        { text: 'Notes', value: 'hasNotes' }
      ],
      statsHeaders: [],
      // Models
      search: undefined,
      userSearch: undefined,
      dialog: false,
      userDialog: false,
      user: undefined,
      editing: undefined,
      saving: false,
      error: undefined,
      tab: undefined,
      sure: false,
      everyFilter: [],
      userType: 'all',
      statType: undefined,
      statSearch: undefined,
      statSince: undefined
    }
  },
  async fetch () {
    const version = encodeURIComponent(this.$config.version)
    this.you = await this.$axios.$get(`/api/tournaments/me?v=${version}`)
    await this.loadUsers()
    const { t } = this.$route.query
    if (t) {
      await this.loadToday()
      this.tab = 1
      const tid = parseInt(t, 10)
      const f = this.todays.find(({ id }) => id === tid)
      if (f) {
        this.edit(f)
      }
    }
    this.$axios.$get('/api/tournaments/stats/list').then((list) => {
      this.statList = list
    })
  },
  computed: {
    recurring () {
      if (this.everyFilter.length > 0) {
        return this.ts.filter(t => this.everyFilter.includes(t.every))
      }
      return this.ts
    }
  },
  watch: {
    async tab () {
      if (this.tab === 1 && this.todays.length === 0) {
        return await this.loadToday()
      }
      if (this.tab === 2 && this.ts.length === 0) {
        return await this.loadRecurring()
      }
      if (this.tab === 3 && this.status.length === 0) {
        return await this.loadStatus()
      }
    },
    async userType () {
      await this.loadUsers()
    },
    async statType () {
      await this.loadStats()
    },
    async statSince () {
      await this.loadStats()
    }
  },
  methods: {
    async loadUsers () {
      const url = `/api/tournaments/td/users/${this.userType}`
      const users = await this.$axios.$get(url)
      this.users = users.map(user => ({ ...user, roleList: user.roles.join() }))
    },
    async loadToday () {
      const { tournaments } = await this.$axios.$get('/api/tournaments/td/today')
      this.todays = tournaments
    },
    async loadRecurring () {
      const { tournaments } = await this.$axios.$get('/api/tournaments/td')
      this.ts = tournaments
    },
    async loadStatus () {
      this.status = await this.$axios.$get('/api/tournaments/td/status')
    },
    async loadStats () {
      if (!this.statType) {
        return
      }
      const query = this.statSince ? `?s=${encodeURIComponent(this.statSince)}` : ''
      const url = `/api/tournaments/stats/read/${encodeURIComponent(this.statType)}${query}`

      const { name, units, format, stats } = await this.$axios.$get(url)

      this.stats = stats

      this.statsHeaders = [
        { text: name, value: 'name' },
        {
          text: units,
          value: 'f',
          align: 'end'
        }
      ]

      if (stats.length === 0) {
        this.statsMinMax = []
      } else {
        let min = 0
        let max = 0
        let sum = 0

        const nf = new Intl.NumberFormat(undefined, format)

        stats.forEach((stat, index) => {
          const { value } = stat
          stat.f = nf.format(value)
          sum += value
          if (value <= stats[min].value) {
            min = index
          }
          if (value >= stats[max].value) {
            max = index
          }
        })
        this.statsMinMax = [
          { name: 'average', value: sum / stats.length, f: nf.format(sum / stats.length) },
          { ...stats[min], name: `lowest:  ${stats[min].name}` },
          { ...stats[max], name: `highest: ${stats[max].name}` }
        ]
      }
    },
    statSort (items, [name], [isDesc]) {
      items.sort((a, b) => {
        let n = 0
        if (name === 'name') {
          n = a.name.localeCompare(b.name)
        }
        if (name === 'f') {
          n = b.value - a.value
        }
        return isDesc ? -n : n
      })
      return items
    },
    edit (t) {
      this.editing = JSON.parse(JSON.stringify(t))
      this.sure = false
      this.dialog = true
    },
    editUser (u) {
      this.user = JSON.parse(JSON.stringify(u))
      this.userDialog = true
    },
    duplicate () {
      this.editing = JSON.parse(JSON.stringify(this.editing))
      this.editing.id = 0
      this.editing.name = ''
      this.editing.signup_opened = 0
      this.editing.signup_closed = 0
      this.editing.started = 0
      this.editing.scheduled = 0
      this.editing.finished = 0
      this.editing.recurring_source = 0
    },
    async save () {
      this.saving = true
      try {
        const { tournament, error } =
          await this.$axios.$post('/api/tournaments/td/save', this.editing)
        if (error) {
          this.error = error
          return setTimeout(() => { this.error = undefined }, 3000)
        }
        const list = tournament.recurring ? this.ts : this.todays
        const i = list.findIndex(({ id }) => id === tournament.id)
        if (i >= 0) {
          list.splice(i, 1, tournament)
        } else if (tournament.recurring) {
          await this.loadRecurring()
        } else {
          await this.loadToday()
        }
        this.dialog = false
      } finally {
        this.saving = false
      }
    },
    async saveUser () {
      this.saving = true
      try {
        const { error } =
          await this.$axios.$post('/api/tournaments/td/save/user', this.user)
        if (error) {
          this.error = error
          return setTimeout(() => { this.error = undefined }, 3000)
        }
        await this.loadUsers()
        this.userDialog = false
      } finally {
        this.saving = false
      }
    },
    async remove () {
      this.saving = true
      try {
        const { id, recurring } = this.editing
        const { error } =
          await this.$axios.$get(`/api/tournaments/td/delete/${id}`)
        if (error) {
          this.error = error
          return setTimeout(() => { this.error = undefined }, 3000)
        }
        const list = recurring ? this.ts : this.todays
        const i = list.findIndex(t => t.id === id)
        if (i >= 0) {
          list.splice(i, 1)
        }
        this.dialog = false
      } finally {
        this.saving = false
      }
    }
  }
}
</script>
