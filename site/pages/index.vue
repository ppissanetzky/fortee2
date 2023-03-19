<template>
  <v-app>
    <v-main>
      <v-card flat max-width="960px">
        <v-item-group active-class="primary">
          <v-container>
            <v-row>
              <v-col
                v-for="n in 4"
                :key="n"
                cols="3"
              >
                <v-item v-slot="{ active, toggle }">
                  <v-img
                    :src="`${bones[n - 1]}.png`"
                    @click="toggle"
                  >
                    <div v-if="active" ext-h2 flex-grow-1 text-center />
                  </v-img>
                </v-item>
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="1" />
              <v-col
                v-for="n in 3"
                :key="n"
                cols="3"
              >
                <v-item v-slot="{ active, toggle }">
                  <v-img
                    :src="`${bones[n + 3]}.png`"
                    @click="toggle"
                  >
                    <div v-if="active" ext-h2 flex-grow-1 text-center />
                  </v-img>
                </v-item>
              </v-col>
            </v-row>
          </v-container>
        </v-item-group>
      </v-card>
    </v-main>
  </v-app>
</template>
<script>
export default {
  data () {
    return {
      bones: [
        '66',
        '54',
        '60',
        '51',
        '10',
        '00',
        '32'
      ]
    }
  },
  fetch () {
  },
  computed: {
  },
  watch: {
  },
  mounted () {
  },
  methods: {
  }
}
</script>
